(function initCore(global) {
  "use strict";

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
    // Page loading spinner/overlay has been removed per request.
  }

  function initSettings() {
    try {
      var globalSettings = JSON.parse(localStorage.getItem('luxe_global_settings') || '{}');
      
      // Update Navbar Logo
      if (globalSettings.logoText) {
        var logoEls = qsa('.logo, [data-config="logo"]');
        logoEls.forEach(function(el) { el.textContent = globalSettings.logoText; });
      }

      // Update Footer Settings
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
      console.warn("Failed to apply settings", e);
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
      console.warn("Failed to decode JWT payload", error);
      return null;
    }
  }

  function getAuthContext() {
    var token = localStorage.getItem("token");
    if (!token) {
      return {
        token: "",
        payload: null,
        accountId: null,
        role: "",
        fullName: "",
        email: localStorage.getItem("userEmail") || ""
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
      email: localStorage.getItem("userEmail") || ""
    };
  }

  function isAdminRole(role) {
    return String(role || "").trim().toLowerCase() === "admin";
  }

  function isReceptionistRole(role) {
    var normalized = String(role || "").trim().toLowerCase();
    return normalized === "lễ tân"
      || normalized === "le tan"
      || normalized === "letan"
      || normalized === "receptionist"
      || normalized === "staff"
      || normalized === "employee";
  }

  function applyRoleAccess() {
    var auth = getAuthContext();
    var pathname = (window.location.pathname || "").toLowerCase();
    var pageName = pathname.split("/").pop();
    var adminOnlyPages = ["account.html"];
    var adminOnlyLinks = ['a.sidebar-item[href="account.html"]'];

    if (!isAdminRole(auth.role)) {
      adminOnlyLinks.forEach(function(selector) {
        qsa(selector).forEach(function(link) {
          link.style.display = "none";
        });
      });

      if (adminOnlyPages.indexOf(pageName) >= 0) {
        window.location.replace("dashboard.html");
      }
    }
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
      initAnimations();
      initSettings();
      initAdminSidebarToggle();
      applyRoleAccess();
  });

  global.AppCore = {
    qs: qs,
    qsa: qsa,
    debounce: debounce,
    throttle: throttle,
    toast: toast,
    decodeJwtPayload: decodeJwtPayload,
    getAuthContext: getAuthContext,
    isAdminRole: isAdminRole,
    isReceptionistRole: isReceptionistRole,
    initAnimations: initAnimations,
    initAdminSidebarToggle: initAdminSidebarToggle
  };
})(window);
