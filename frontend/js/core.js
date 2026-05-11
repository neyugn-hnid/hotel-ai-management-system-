(function initCore(global) {
  "use strict";

  var AUTH_API_BASE_URL = "https://localhost:7082/api/Auth";
  var API_BASE_URL = "https://localhost:7082/api";
  var TOKEN_KEY = "token";
  var REFRESH_TOKEN_KEY = "refreshToken";
  var USER_EMAIL_KEY = "userEmail";
  var refreshPromise = null;
  var originalFetch = global.fetch ? global.fetch.bind(global) : null;

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

      return JSON.parse(atob(payload));
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
    initAdminSidebarToggle: initAdminSidebarToggle
  };
})(window);
