(function initCore(global) {
  "use strict";

  var AUTH_API_BASE_URL = "https://localhost:7082/api/Auth";
  var API_BASE_URL = "https://localhost:7082/api";
  var TOKEN_KEY = "token";
  var REFRESH_TOKEN_KEY = "refreshToken";
  var USER_EMAIL_KEY = "userEmail";
  var refreshPromise = null;
  var originalFetch = global.fetch ? global.fetch.bind(global) : null;
  var adminBookingBadgeTimer = null;
  var adminBookingBadgeRefreshInFlight = null;
  var adminBookingRealtimeConnection = null;
  var adminBookingRealtimeScriptPromise = null;
  var adminWebsiteBookingAlertTimer = null;
  var adminWebsiteBookingLastCount = null;

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function debounce(fn, wait) {
    var timeoutId;
    return function debounced() {
      var context = this;
      var args = arguments;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function run() {
        fn.apply(context, args);
      }, wait);
    };
  }

  function throttle(fn, wait) {
    var waiting = false;
    return function throttled() {
      if (waiting) return;
      waiting = true;
      var context = this;
      var args = arguments;
      fn.apply(context, args);
      setTimeout(function reset() {
        waiting = false;
      }, wait);
    };
  }

  function ensureValidationMessage(input) {
    if (!input || !input.parentNode) return null;

    var next = input.nextElementSibling;
    if (next && next.classList && next.classList.contains("app-field-error")) {
      return next;
    }

    var message = document.createElement("div");
    message.className = "app-field-error";
    message.style.color = "#dc2626";
    message.style.fontSize = "0.8rem";
    message.style.marginTop = "0.35rem";
    message.style.lineHeight = "1.4";
    input.insertAdjacentElement("afterend", message);
    return message;
  }

  function clearFieldError(input) {
    if (!input) return;
    input.style.borderColor = "";
    input.removeAttribute("aria-invalid");
    var next = input.nextElementSibling;
    if (next && next.classList && next.classList.contains("app-field-error")) {
      next.textContent = "";
    }
  }

  function setFieldError(input, message) {
    if (!input) return false;
    input.style.borderColor = "#dc2626";
    input.setAttribute("aria-invalid", "true");
    var holder = ensureValidationMessage(input);
    if (holder) {
      holder.textContent = message;
    }
    return false;
  }

  function clearFormErrors(form) {
    if (!form) return;
    qsa("input, select, textarea", form).forEach(clearFieldError);
  }

  function normalizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
  }

  function isValidPhone(value) {
    var digits = normalizeDigits(value);
    return digits.length >= 9 && digits.length <= 11;
  }

  function isValidIdentityCard(value) {
    var digits = normalizeDigits(value);
    return digits.length === 9 || digits.length === 12;
  }

  function isPositiveNumber(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  function parseFlexibleDate(value) {
    var normalized = normalizeText(value);
    if (!normalized) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      var isoDate = new Date(normalized + "T00:00:00");
      return Number.isNaN(isoDate.getTime()) ? null : isoDate;
    }

    var match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      var ddmmyyyy = new Date(match[3] + "-" + match[2] + "-" + match[1] + "T00:00:00");
      return Number.isNaN(ddmmyyyy.getTime()) ? null : ddmmyyyy;
    }

    var parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function validateFields(form, rules) {
    if (!form || !Array.isArray(rules)) return true;

    clearFormErrors(form);

    for (var i = 0; i < rules.length; i += 1) {
      var rule = rules[i];
      var input = typeof rule.input === "string" ? form.querySelector(rule.input) || document.getElementById(rule.input) : rule.input;
      if (!input) continue;

      var value = "value" in input ? input.value : "";
      var message = rule.validate(value, input, form);
      if (message) {
        setFieldError(input, message);
        if (typeof input.focus === "function") {
          input.focus();
        }
        return false;
      }
    }

    return true;
  }

  function getNativeValidationMessage(input) {
    if (!input || !input.validity) return "Giá trị không hợp lệ.";

    if (input.validity.valueMissing) {
      return "Trường này không được để trống.";
    }
    if (input.validity.typeMismatch) {
      if (String(input.type || "").toLowerCase() === "email") {
        return "Email không đúng định dạng.";
      }
      return "Giá trị không đúng định dạng.";
    }
    if (input.validity.patternMismatch) {
      return "Giá trị không đúng định dạng.";
    }
    if (input.validity.tooShort) {
      return "Giá trị nhập vào quá ngắn.";
    }
    if (input.validity.tooLong) {
      return "Giá trị nhập vào quá dài.";
    }
    if (input.validity.rangeUnderflow || input.validity.rangeOverflow || input.validity.stepMismatch) {
      return "Giá trị số không hợp lệ.";
    }

    return "Giá trị không hợp lệ.";
  }

  function initFormValidation() {
    qsa("form").forEach(function(form) {
      form.noValidate = true;
    });

    document.addEventListener("invalid", function(event) {
      var input = event.target;
      if (!input || !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) {
        return;
      }

      event.preventDefault();
      setFieldError(input, getNativeValidationMessage(input));
    }, true);

    document.addEventListener("input", function(event) {
      var input = event.target;
      if (!input || !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
        return;
      }
      clearFieldError(input);
    }, true);

    document.addEventListener("change", function(event) {
      var input = event.target;
      if (!input || !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) {
        return;
      }
      clearFieldError(input);
    }, true);
  }

  var Validation = {
    clearFieldError: clearFieldError,
    clearFormErrors: clearFormErrors,
    setFieldError: setFieldError,
    normalizeDigits: normalizeDigits,
    normalizeText: normalizeText,
    isValidEmail: isValidEmail,
    isValidPhone: isValidPhone,
    isValidIdentityCard: isValidIdentityCard,
    isPositiveNumber: isPositiveNumber,
    parseFlexibleDate: parseFlexibleDate,
    validateFields: validateFields,
    getNativeValidationMessage: getNativeValidationMessage,
    initFormValidation: initFormValidation
  };

  function createToastContainer() {
    var container = qs("#app-toast-container");
    if (container) return container;

    container = document.createElement("div");
    container.id = "app-toast-container";
    container.style.position = "fixed";
    container.style.right = "1rem";
    container.style.top = "1rem";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "0.5rem";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
    return container;
  }

  function toast(message, variant) {
    var container = createToastContainer();
    var item = document.createElement("div");
    var isError = variant === "error";

    item.textContent = message;
    item.style.padding = "0.65rem 0.85rem";
    item.style.borderRadius = "0.75rem";
    item.style.color = "#fff";
    item.style.fontSize = "0.875rem";
    item.style.maxWidth = "22rem";
    item.style.background = isError ? "#dc2626" : "#00c542";
    item.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.25)";
    item.style.opacity = "0";
    item.style.transform = "translateY(8px)";
    item.style.transition = "opacity 220ms ease, transform 220ms ease";

    container.appendChild(item);

    requestAnimationFrame(function show() {
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    });

    setTimeout(function hide() {
      item.style.opacity = "0";
      item.style.transform = "translateY(8px)";
      setTimeout(function remove() {
        if (item.parentNode) {
          item.parentNode.removeChild(item);
        }
      }, 220);
    }, 2400);
  }

  function playAdminWebsiteBookingSound() {
    try {
      var AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextCtor) return;
      var ctx = new AudioContextCtor();
      var now = ctx.currentTime;
      var gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

      [880, 1174].forEach(function(freq, index) {
        var osc = ctx.createOscillator();
        osc.type = index === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, now + index * 0.09);
        osc.connect(gain);
        osc.start(now + index * 0.09);
        osc.stop(now + 0.28 + index * 0.09);
      });
    } catch (_) {
    }
  }

  function ensureAdminWebsiteBookingAlertStyles() {
    if (qs("#admin-website-booking-alert-style")) return;
    var style = document.createElement("style");
    style.id = "admin-website-booking-alert-style";
    style.textContent =
      ".admin-website-booking-alert-overlay{position:fixed;inset:0;background:rgba(15,23,42,.32);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;z-index:1200;padding:16px;}" +
      ".admin-website-booking-alert-modal{background:#fff;width:min(480px,100%);border-radius:24px;box-shadow:0 40px 100px rgba(0,0,0,.2);padding:28px;}" +
      ".admin-website-booking-alert-header{display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;}" +
      ".admin-website-booking-alert-icon{width:54px;height:54px;border-radius:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:linear-gradient(135deg,#f97316,#dc2626);color:#fff;}" +
      ".admin-website-booking-alert-icon .material-symbols-outlined{font-size:28px;}" +
      ".admin-website-booking-alert-copy{min-width:0;flex:1;}" +
      ".admin-website-booking-alert-title{margin:0 0 4px;font-size:24px;font-weight:800;letter-spacing:-0.03em;color:#111827;}" +
      ".admin-website-booking-alert-code{margin:0;color:#6b7280;font-size:14px;line-height:1.5;}" +
      ".admin-website-booking-alert-message{margin:0 0 24px;color:#111827;font-size:14px;line-height:1.7;}" +
      ".admin-website-booking-alert-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}" +
      ".admin-website-booking-alert-btn{width:100%;min-width:0;height:46px;border-radius:12px;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:pointer;}" +
      ".admin-website-booking-alert-btn--secondary{background:#fff;border:1px solid rgba(0,0,0,.08);color:#111827;}" +
      ".admin-website-booking-alert-btn--primary{background:#007bff;border:1px solid #007bff;color:#fff;}" +
      "@media (max-width:768px){.admin-website-booking-alert-actions{grid-template-columns:1fr;}}";
    document.head.appendChild(style);
  }

  function ensureAdminWebsiteBookingAlertModal() {
    var modal = qs("#adminWebsiteBookingAlert");
    if (modal) return modal;
    ensureAdminWebsiteBookingAlertStyles();
    modal = document.createElement("div");
    modal.id = "adminWebsiteBookingAlert";
    modal.className = "admin-website-booking-alert-overlay";
    modal.innerHTML =
      '<div class="admin-website-booking-alert-modal">' +
        '<div class="admin-website-booking-alert-header">' +
          '<div class="admin-website-booking-alert-icon"><span class="material-symbols-outlined">notifications_active</span></div>' +
          '<div class="admin-website-booking-alert-copy">' +
            '<h3 class="admin-website-booking-alert-title">Có booking mới từ web</h3>' +
            '<p id="adminWebsiteBookingAlertCode" class="admin-website-booking-alert-code">Đang cập nhật...</p>' +
          '</div>' +
        '</div>' +
        '<p id="adminWebsiteBookingAlertMessage" class="admin-website-booking-alert-message">Khách vừa gửi yêu cầu đặt phòng từ website. Hãy kiểm tra khu vực chờ xử lý để xác nhận nhanh.</p>' +
        '<div class="admin-website-booking-alert-actions">' +
          '<button type="button" class="admin-website-booking-alert-btn admin-website-booking-alert-btn--secondary" data-admin-booking-alert-close>Đóng</button>' +
          '<button type="button" class="admin-website-booking-alert-btn admin-website-booking-alert-btn--primary" data-admin-booking-alert-open>Xem ngay</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    qs("[data-admin-booking-alert-close]", modal).addEventListener("click", function() {
      closeAdminWebsiteBookingAlert();
    });
    qs("[data-admin-booking-alert-open]", modal).addEventListener("click", function() {
      focusAdminPendingWebsiteBookings();
    });
    return modal;
  }

  function showAdminWebsiteBookingAlert(payload) {
    var modal = ensureAdminWebsiteBookingAlertModal();
    var codeEl = qs("#adminWebsiteBookingAlertCode", modal);
    var msgEl = qs("#adminWebsiteBookingAlertMessage", modal);
    var bookingCode = payload && payload.bookingCode ? payload.bookingCode : "booking mới";
    if (codeEl) {
      codeEl.textContent = "Mã phiếu: " + bookingCode;
    }
    if (msgEl) {
      msgEl.textContent = "Khách vừa gửi yêu cầu đặt phòng từ website. Hãy kiểm tra khu vực chờ xử lý để xác nhận nhanh.";
    }
    modal.style.display = "flex";
    if (adminWebsiteBookingAlertTimer) {
      clearTimeout(adminWebsiteBookingAlertTimer);
    }
    adminWebsiteBookingAlertTimer = setTimeout(function() {
      closeAdminWebsiteBookingAlert();
    }, 9000);
  }

  function closeAdminWebsiteBookingAlert() {
    var modal = qs("#adminWebsiteBookingAlert");
    if (modal) modal.style.display = "none";
  }

  function focusAdminPendingWebsiteBookings() {
    closeAdminWebsiteBookingAlert();
    var pageName = ((global.location && global.location.pathname) || "").toLowerCase().split("/").pop();
    if (pageName === "booking.html") {
      var section = qs("#bookingRequestsBody");
      if (section && typeof section.scrollIntoView === "function") {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    global.location.href = "booking.html";
  }

  function getAdminBookingSource(raw) {
    var source = String((raw && raw.source) || "").trim().toLowerCase();
    if (source === "website" || source === "web") return "website";
    if (source === "internal") return "internal";
    var bookingCode = String((raw && raw.bookingCode) || "").trim().toUpperCase();
    var notes = String((raw && raw.notes) || "").trim().toLowerCase();
    var accountId = Number((raw && raw.accountId) || 0);
    if (bookingCode.indexOf("BKG-WEB") === 0 || notes.indexOf("website") >= 0 || notes.indexOf("đặt qua web") >= 0 || notes.indexOf("dat qua web") >= 0) {
      return "website";
    }
    return accountId > 0 ? "internal" : "website";
  }

  function loadSignalRScript() {
    if (global.signalR) {
      return Promise.resolve();
    }
    if (adminBookingRealtimeScriptPromise) {
      return adminBookingRealtimeScriptPromise;
    }
    adminBookingRealtimeScriptPromise = new Promise(function(resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js";
      script.onload = function() { resolve(); };
      script.onerror = function() { reject(new Error("Không thể tải SignalR.")); };
      document.head.appendChild(script);
    });
    return adminBookingRealtimeScriptPromise;
  }

  async function initAdminBookingRealtime() {
    if (!qs(".admin-layout")) return;
    if (adminBookingRealtimeConnection) return;
    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await loadSignalRScript();
    } catch (_) {
      return;
    }
    if (!global.signalR) return;

    adminBookingRealtimeConnection = new global.signalR.HubConnectionBuilder()
      .withUrl(API_BASE_URL.replace(/\/api$/, "") + "/bookingHub", {
        accessTokenFactory: function() {
          return localStorage.getItem(TOKEN_KEY) || "";
        }
      })
      .withAutomaticReconnect()
      .build();

    adminBookingRealtimeConnection.on("bookingCreated", function(payload) {
      var bookingCode = payload && payload.bookingCode ? payload.bookingCode : "booking mới";
      if (getAdminBookingSource(payload) === "website") {
        toast("Có phiếu đặt phòng mới từ website: " + bookingCode, "success");
        playAdminWebsiteBookingSound();
        showAdminWebsiteBookingAlert(payload);
      } else {
        toast("Có booking mới: " + bookingCode, "success");
      }
      void refreshAdminBookingBadge();
    });

    adminBookingRealtimeConnection.on("bookingUpdated", function() {
      void refreshAdminBookingBadge();
    });

    try {
      await adminBookingRealtimeConnection.start();
    } catch (_) {
      adminBookingRealtimeConnection = null;
    }
  }

  function initAnimations() {
    
  }

  function initSettings() {
    try {
      var globalSettings = JSON.parse(localStorage.getItem('luxe_global_settings') || '{}');
      
      
      if (globalSettings.logoText) {
        var logoEls = qsa('.logo, [data-config="logo"]');
        logoEls.forEach(function(el) { el.textContent = globalSettings.logoText; });
      }

      
      if (globalSettings.address) {
        var addressEls = qsa('[data-config="address"]');
        addressEls.forEach(function(el) { el.textContent = globalSettings.address; });
      }

      if (globalSettings.phone) {
        var phoneEls = qsa('[data-config="phone"]');
        phoneEls.forEach(function(el) { el.textContent = globalSettings.phone; });
      }

      if (globalSettings.email) {
        var emailEls = qsa('[data-config="email"]');
        emailEls.forEach(function(el) { el.textContent = globalSettings.email; });
      }
    } catch (e) {

    }
  }

  function decodeJwtPayload(token) {
    try {
      var parts = String(token || "").split(".");
      if (parts.length < 2) return null;

      var payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (payload.length % 4) {
        payload += "=";
      }

      var binary = atob(payload);
      var bytes = Uint8Array.from(binary, function(char) {
        return char.charCodeAt(0);
      });
      var json = new TextDecoder("utf-8").decode(bytes);
      return JSON.parse(json);
    } catch (error) {

      return null;
    }
  }

  function getAuthContext() {
    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return {
        token: "",
        payload: null,
        accountId: null,
        role: "",
        fullName: "",
        email: localStorage.getItem(USER_EMAIL_KEY) || ""
      };
    }

    var payload = decodeJwtPayload(token);
    var role = payload
      ? (payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || payload.role || "")
      : "";
    var fullName = payload
      ? (payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] || payload.name || "")
      : "";
    var rawAccountId = payload ? (payload.sub || payload.nameid || payload.accountId || "") : "";
    var accountId = Number(rawAccountId || 0);

    return {
      token: token,
      payload: payload,
      accountId: accountId > 0 ? accountId : null,
      role: role,
      fullName: fullName,
      email: localStorage.getItem(USER_EMAIL_KEY) || ""
    };
  }

  function isAdminRole(role) {
    return normalizeRoleKey(role) === "admin";
  }

  function normalizeRoleKey(role) {
    return String(role || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]/g, "");
  }

  function isReceptionistRole(role) {
    var normalized = normalizeRoleKey(role);
    return normalized === "letan"
      || normalized === "receptionist"
      || normalized === "staff"
      || normalized === "employee"
      || normalized === "nhanvien";
  }

  function getResolvedRole() {
    var auth = getAuthContext();
    if (auth && auth.role) {
      return String(auth.role).trim();
    }

    var token = localStorage.getItem(TOKEN_KEY);
    var payload = decodeJwtPayload(token);
    if (!payload) return "";

    return String(
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
      || payload.role
      || ""
    ).trim();
  }

  function setAuthSession(accessToken, refreshToken, email) {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    if (email) {
      localStorage.setItem(USER_EMAIL_KEY, email);
    }
  }

  function clearAuthSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
      localStorage.removeItem("accountId");
      localStorage.removeItem("customerId");
      localStorage.removeItem("customerName");
      localStorage.removeItem("customerPhone");
      localStorage.removeItem("pending_invoice_booking");
    } catch (error) {

    }
  }

  async function refreshAccessToken() {
    var refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    var email = localStorage.getItem(USER_EMAIL_KEY) || "";

    if (!refreshToken || !originalFetch) {
      throw new Error("Không có refresh token.");
    }

    var response = await originalFetch(AUTH_API_BASE_URL + "/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refreshToken: refreshToken
      })
    });

    var data = await response.json().catch(function() {
      return {};
    });

    if (!response.ok || !data.token || !data.refreshToken) {
      throw new Error(data.message || "Không thể làm mới phiên đăng nhập.");
    }

    setAuthSession(data.token, data.refreshToken, email);
    return data.token;
  }

  async function ensureFreshAccessToken() {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(function() {
        refreshPromise = null;
      });
    }

    return refreshPromise;
  }

  function shouldHandleUnauthorized(url) {
    var normalizedUrl = String(url || "");
    return normalizedUrl.indexOf(API_BASE_URL) === 0
      && normalizedUrl.indexOf("/api/Auth/login") === -1
      && normalizedUrl.indexOf("/api/Auth/register") === -1
      && normalizedUrl.indexOf("/api/Auth/refresh") === -1;
  }

  function buildRetriedInit(init, newToken) {
    var nextInit = Object.assign({}, init || {});
    var nextHeaders = new Headers(nextInit.headers || {});
    nextHeaders.set("Authorization", "Bearer " + newToken);
    nextInit.headers = nextHeaders;
    nextInit.__isRetryAfterRefresh = true;
    return nextInit;
  }

  function patchGlobalFetch() {
    if (!originalFetch || global.__appFetchPatched) {
      return;
    }

    global.fetch = async function patchedFetch(input, init) {
      var response = await originalFetch(input, init);
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var alreadyRetried = Boolean(init && init.__isRetryAfterRefresh);

      if (response.status !== 401 || alreadyRetried || !shouldHandleUnauthorized(url)) {
        return response;
      }

      if (!localStorage.getItem(REFRESH_TOKEN_KEY)) {
        return response;
      }

      try {
        var newToken = await ensureFreshAccessToken();
        return await originalFetch(input, buildRetriedInit(init, newToken));
      } catch (error) {
        clearAuthSession();
        if ((window.location.pathname || "").toLowerCase().indexOf("index.html") === -1) {
          window.location.replace("index.html");
        }
        return response;
      }
    };

    global.__appFetchPatched = true;
  }

  async function logout() {
    var token = localStorage.getItem(TOKEN_KEY);
    var refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (token) {
      try {
        await fetch(AUTH_API_BASE_URL + "/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({
            refreshToken: refreshToken || ""
          })
        });
      } catch (error) {

      }
    }

    clearAuthSession();
    window.location.replace("index.html");
  }

  function encodeHtml(text) {
    return String(text || "").replace(/[&<>"']/g, function(char) {
      return ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char];
    });
  }

  function getUserInitials(fullName, email) {
    var source = String(fullName || email || "").trim();
    if (!source) return "U";

    var parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 1).toUpperCase();
    }

    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
  }

  function buildPublicUserMenu(auth) {
    var fullName = String(auth && auth.fullName || "").trim();
    var email = String(auth && auth.email || "").trim();
    var label = fullName || email || "Tài khoản";
    var initials = getUserInitials(fullName, email);

    return (
      '<div class="public-user-menu" data-public-user-menu>' +
        '<button type="button" class="public-user-menu__trigger" data-public-user-trigger aria-expanded="false" aria-label="Mo menu tai khoan">' +
          '<span class="public-user-menu__avatar">' + initials + '</span>' +
        '</button>' +
        '<div class="public-user-menu__dropdown" data-public-user-dropdown>' +
          '<div class="public-user-menu__meta">' +
            '<div class="public-user-menu__name">' + encodeHtml(label) + '</div>' +
            (email ? '<div class="public-user-menu__email">' + encodeHtml(email) + '</div>' : '') +
          '</div>' +
          '<button type="button" class="public-user-menu__logout" data-public-logout>' +
            '<span class="material-symbols-outlined">logout</span>' +
            '<span>Đăng xuất</span>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function bindPublicUserMenus(root) {
    qsa("[data-public-user-menu]", root || document).forEach(function(menu) {
      if (menu.__boundPublicUserMenu) return;
      menu.__boundPublicUserMenu = true;

      var trigger = qs("[data-public-user-trigger]", menu);
      var logoutBtn = qs("[data-public-logout]", menu);

      if (trigger) {
        trigger.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();

          var isOpen = menu.classList.contains("is-open");
          qsa("[data-public-user-menu].is-open").forEach(function(item) {
            item.classList.remove("is-open");
            var btn = qs("[data-public-user-trigger]", item);
            if (btn) btn.setAttribute("aria-expanded", "false");
          });

          if (!isOpen) {
            menu.classList.add("is-open");
            trigger.setAttribute("aria-expanded", "true");
          }
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener("click", function(event) {
          event.preventDefault();
          event.stopPropagation();
          void logout();
        });
      }
    });
  }

  function initPublicUserMenu() {
    if (qs(".admin-layout")) return;

    var auth = getAuthContext();
    var isLoggedIn = Boolean(auth && auth.token);

    qsa(".navbar .navbar__actions").forEach(function(actions) {
      if (!actions) return;

      qsa('[onclick*="openLoginModal"], [data-auth-login-trigger]', actions).forEach(function(el) {
        el.style.display = isLoggedIn ? "none" : "";
      });

      var existing = qs("[data-public-user-menu]", actions);
      if (!isLoggedIn) {
        if (existing) existing.remove();
        return;
      }

      if (existing) existing.remove();
      actions.insertAdjacentHTML("beforeend", buildPublicUserMenu(auth));
    });

    bindPublicUserMenus(document);
  }

  function applyPublicAuthVisibility() {
    var isLoggedIn = Boolean(localStorage.getItem(TOKEN_KEY));
    qsa('button[onclick*="openLoginModal"], [data-auth-login-trigger]').forEach(function(el) {
      el.style.display = isLoggedIn ? "none" : "";
    });
    initPublicUserMenu();
  }

  function applyRoleAccess() {
    var auth = getAuthContext();
    var resolvedRole = getResolvedRole();
    var pathname = (window.location.pathname || "").toLowerCase();
    var pageName = pathname.split("/").pop();
    var adminOnlyPages = ["account.html"];
    var adminOnlyLinks = ['a.sidebar-item[href="account.html"]'];
    var receptionistHiddenLinks = ['a.sidebar-item[href="dashboard.html"]'];
    var receptionistRedirectPages = ["dashboard.html"];

    if (!isAdminRole(resolvedRole)) {
      adminOnlyLinks.forEach(function(selector) {
        qsa(selector).forEach(function(link) {
          link.style.display = "none";
        });
      });

      if (adminOnlyPages.indexOf(pageName) >= 0) {
        window.location.replace("index.html");
      }
    }

    
    if (isReceptionistRole(resolvedRole)) {
      
      ['#btnAddAccount', '#btnAddRoom', '#btnAddService'].forEach(function(id) {
        var el = qs(id);
        if (el) el.style.display = 'none';
      });
      qsa('a.sidebar-item[href="account.html"]').forEach(function(link) { link.style.display = 'none'; });
      receptionistHiddenLinks.forEach(function(selector) {
        qsa(selector).forEach(function(link) {
          link.style.display = "none";
        });
      });
      if (receptionistRedirectPages.indexOf(pageName) >= 0) {
        window.location.replace("booking.html");
      }
    }
  }

  function initLogoutActions() {
    qsa("a.sidebar-item").forEach(function(link) {
      var icon = link.querySelector(".material-symbols-outlined");
      var label = (link.textContent || "").trim().toLowerCase();
      var iconName = icon ? String(icon.textContent || "").trim().toLowerCase() : "";

      if (iconName !== "logout" && label.indexOf("đăng xuất") === -1) {
        return;
      }

      link.addEventListener("click", function(event) {
        event.preventDefault();
        void logout();
      });
    });
  }

  function initPublicNavbarToggle() {
    var navbar = qs(".navbar");
    var links = navbar ? qs(".navbar__links", navbar) : null;
    if (!navbar || !links || qs(".admin-layout")) return;

    var toggleBtn = qs("#public-menu-toggle");
    var panel = qs("#public-nav-panel");

    function isMobile() {
      return window.matchMedia("(max-width: 1024px)").matches;
    }

    function getActionsMarkup() {
      var actions = qs(".navbar__actions", navbar);
      return actions ? actions.innerHTML : "";
    }

    function ensurePanel() {
      if (panel) return panel;

      panel = document.createElement("div");
      panel.id = "public-nav-panel";
      panel.className = "public-nav-panel";
      document.body.appendChild(panel);
      return panel;
    }

    function ensureToggle() {
      if (toggleBtn) return toggleBtn;

      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.id = "public-menu-toggle";
      toggleBtn.className = "public-menu-toggle";
      toggleBtn.setAttribute("aria-label", "Mo menu dieu huong");
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
      navbar.appendChild(toggleBtn);
      return toggleBtn;
    }

    function setToggleState(isOpen) {
      if (!toggleBtn) return;
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggleBtn.setAttribute("aria-label", isOpen ? "Dong menu dieu huong" : "Mo menu dieu huong");

      var icon = toggleBtn.querySelector(".material-symbols-outlined");
      if (icon) {
        icon.textContent = isOpen ? "close" : "menu";
      }
    }

    function renderPanel() {
      var menuPanel = ensurePanel();
      menuPanel.innerHTML =
        '<div class="public-nav-panel__inner">' +
          '<div class="public-nav-panel__links">' + links.innerHTML + '</div>' +
          '<div class="public-nav-panel__actions">' + getActionsMarkup() + '</div>' +
        '</div>';

      qsa("a", menuPanel).forEach(function(link) {
        link.addEventListener("click", closePanel);
      });

      qsa("button", menuPanel).forEach(function(button) {
        if (button.id === "public-menu-toggle") return;
        button.addEventListener("click", function() {
          setTimeout(closePanel, 60);
        });
      });

      bindPublicUserMenus(menuPanel);
    }

    function closePanel() {
      if (panel) {
        panel.classList.remove("active");
      }
      document.body.classList.remove("public-menu-open");
      if (navbar) {
        navbar.classList.remove("navbar--mobile-open");
      }
      setToggleState(false);
    }

    function openPanel() {
      renderPanel();
      if (panel) {
        panel.classList.add("active");
      }
      document.body.classList.add("public-menu-open");
      if (navbar) {
        navbar.classList.add("navbar--mobile-open");
      }
      setToggleState(true);
    }

    ensureToggle();
    ensurePanel();
    renderPanel();
    setToggleState(false);

    toggleBtn.addEventListener("click", function(event) {
      event.preventDefault();
      if (!isMobile()) return;

      if (panel && panel.classList.contains("active")) {
        closePanel();
      } else {
        openPanel();
      }
    });

    document.addEventListener("click", function(event) {
      qsa("[data-public-user-menu].is-open").forEach(function(item) {
        if (!event.target || item.contains(event.target)) return;
        item.classList.remove("is-open");
        var btn = qs("[data-public-user-trigger]", item);
        if (btn) btn.setAttribute("aria-expanded", "false");
      });

      if (!isMobile()) return;
      if (!panel || !panel.classList.contains("active")) return;

      var target = event.target;
      if (!target) return;
      if (target.closest("#public-menu-toggle")) return;
      if (target.closest("#public-nav-panel")) return;
      closePanel();
    });

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closePanel();
      }
    });

    window.addEventListener("resize", function() {
      renderPanel();
      if (!isMobile()) {
        closePanel();
      }
    });
  }

  function initAdminSidebarToggle() {
    var adminLayout = qs(".admin-layout");
    var sidebar = qs(".admin-layout .luxe-sidebar");
    if (!adminLayout || !sidebar) return;

    var toggleBtn = qs("#mobile-menu-toggle");
    var backdrop = qs("#mobile-sidebar-backdrop");

    function isMobile() {
      return window.matchMedia("(max-width: 768px)").matches;
    }

    function setToggleVisualState(isOpen) {
      if (!toggleBtn) return;

      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggleBtn.setAttribute("aria-label", isOpen ? "Dong menu" : "Mo menu");

      var icon = toggleBtn.querySelector(".material-symbols-outlined");
      if (icon) {
        icon.textContent = isOpen ? "close" : "menu";
      }
    }

    function closeSidebar() {
      sidebar.classList.remove("sidebar-open");
      document.body.classList.remove("sidebar-open");
      setToggleVisualState(false);
      if (backdrop) backdrop.classList.remove("active");
    }

    function openSidebar() {
      sidebar.classList.add("sidebar-open");
      document.body.classList.add("sidebar-open");
      setToggleVisualState(true);
      if (backdrop) backdrop.classList.add("active");
    }

    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.id = "mobile-menu-toggle";
      toggleBtn.className = "mobile-menu-toggle";
      toggleBtn.setAttribute("aria-label", "Mo menu");
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
      document.body.appendChild(toggleBtn);
    }

    setToggleVisualState(false);

    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "mobile-sidebar-backdrop";
      backdrop.className = "mobile-sidebar-backdrop";
      document.body.appendChild(backdrop);
    }

    toggleBtn.addEventListener("click", function() {
      if (!isMobile()) return;

      if (sidebar.classList.contains("sidebar-open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    document.addEventListener("click", function(event) {
      if (!isMobile()) return;
      if (!sidebar.classList.contains("sidebar-open")) return;

      var target = event.target;
      if (!target) return;

      if (target.closest(".luxe-sidebar")) return;
      if (target.closest("#mobile-menu-toggle")) return;
      closeSidebar();
    });

    qsa("a.sidebar-item", sidebar).forEach(function(link) {
      link.addEventListener("click", function() {
        if (!isMobile()) return;
        setTimeout(closeSidebar, 120);
      });
    });

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });

    window.addEventListener("resize", function() {
      if (!isMobile()) {
        closeSidebar();
      }
    });
  }

  function ensureAdminBookingBadge() {
    var link = qs('a.sidebar-item[href="booking.html"]');
    if (!link) return null;

    link.id = link.id || "sidebarBookingLink";

    var badge = qs("#sidebarBookingBadge", link);
    if (badge) return badge;

    badge = document.createElement("span");
    badge.id = "sidebarBookingBadge";
    badge.textContent = "0";
    badge.style.display = "none";
    badge.style.marginLeft = "auto";
    badge.style.minWidth = "22px";
    badge.style.height = "22px";
    badge.style.padding = "0 6px";
    badge.style.borderRadius = "999px";
    badge.style.background = "#dc2626";
    badge.style.color = "#fff";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "700";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.lineHeight = "1";
    link.appendChild(badge);
    return badge;
  }

  function updateAdminBookingBadge(count) {
    var badge = ensureAdminBookingBadge();
    if (!badge) return;

    var safeCount = Math.max(0, Number(count || 0));
    if (safeCount <= 0) {
      badge.style.display = "none";
      badge.textContent = "0";
      return;
    }

    badge.style.display = "inline-flex";
    badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
  }

  async function refreshAdminBookingBadge() {
    if (adminBookingBadgeRefreshInFlight) {
      return adminBookingBadgeRefreshInFlight;
    }

    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      adminWebsiteBookingLastCount = null;
      updateAdminBookingBadge(0);
      return 0;
    }

    adminBookingBadgeRefreshInFlight = (async function() {
      try {
        var response = await fetch(API_BASE_URL + "/Bookings?status=" + encodeURIComponent("Chờ xác nhận") + "&source=website&pageNumber=1&pageSize=1", {
          headers: {
            Authorization: "Bearer " + token
          }
        });

        if (!response.ok) {
          throw new Error("Không thể tải số lượng booking chờ xử lý.");
        }

        var data = await response.json().catch(function() {
          return {};
        });
        var totalCount = Number(data && data.totalCount || 0);
        updateAdminBookingBadge(totalCount);
        if (adminWebsiteBookingLastCount !== null && totalCount > adminWebsiteBookingLastCount) {
          var diff = totalCount - adminWebsiteBookingLastCount;
          var message = diff > 1
            ? "Có " + diff + " booking mới từ website."
            : "Có booking mới từ website.";
          toast(message, "success");
          playAdminWebsiteBookingSound();
          showAdminWebsiteBookingAlert({
            bookingCode: diff > 1 ? ("+" + diff + " booking mới") : "booking mới"
          });
        }
        adminWebsiteBookingLastCount = totalCount;
        return totalCount;
      } catch (_) {
        return 0;
      } finally {
        adminBookingBadgeRefreshInFlight = null;
      }
    })();

    return adminBookingBadgeRefreshInFlight;
  }

  function initAdminBookingBadge() {
    if (!qs(".admin-layout")) return;
    if (!qs('a.sidebar-item[href="booking.html"]')) return;

    ensureAdminBookingBadge();
    void refreshAdminBookingBadge();

    if (adminBookingBadgeTimer) {
      clearInterval(adminBookingBadgeTimer);
    }

    adminBookingBadgeTimer = setInterval(function() {
      if (document.hidden) return;
      void refreshAdminBookingBadge();
    }, 5000);

    document.addEventListener("visibilitychange", function() {
      if (!document.hidden) {
        void refreshAdminBookingBadge();
      }
    });
  }


  document.addEventListener("DOMContentLoaded", function() {
      patchGlobalFetch();
      initFormValidation();
      initAnimations();
      initSettings();
      applyPublicAuthVisibility();
      initPublicNavbarToggle();
      initAdminSidebarToggle();
      initLogoutActions();
      applyRoleAccess();
      initAdminBookingBadge();
      void initAdminBookingRealtime();

      
      try {
        var resolvedRole = getResolvedRole();
        if (isReceptionistRole(resolvedRole)) {
          var debouncedApply = debounce(applyRoleAccess, 120);
          var observer = new MutationObserver(function(muts) {
            debouncedApply();
          });
          observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
      } catch (e) {  }
  });

  global.AppCore = {
    qs: qs,
    qsa: qsa,
    debounce: debounce,
    throttle: throttle,
    toast: toast,
    setAuthSession: setAuthSession,
    ensureFreshAccessToken: ensureFreshAccessToken,
    decodeJwtPayload: decodeJwtPayload,
    getAuthContext: getAuthContext,
    isAdminRole: isAdminRole,
    isReceptionistRole: isReceptionistRole,
    clearAuthSession: clearAuthSession,
    logout: logout,
    applyPublicAuthVisibility: applyPublicAuthVisibility,
    initPublicUserMenu: initPublicUserMenu,
    Validation: Validation,
    applyRoleAccess: applyRoleAccess,
    initAnimations: initAnimations,
    initAdminSidebarToggle: initAdminSidebarToggle,
    refreshAdminBookingBadge: refreshAdminBookingBadge
  };
})(window);
