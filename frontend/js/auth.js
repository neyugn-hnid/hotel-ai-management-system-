function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
}

function switchToLogin() {
  closeRegisterModal();
  openLoginModal();
}

function switchToRegister() {
  closeLoginModal();
  openRegisterModal();
}

function openRegisterModal() {
  document.getElementById("registerModal").style.display = "flex";
}
function closeRegisterModal() {
  document.getElementById("registerModal").style.display = "none";
}
async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const validation = window.AppCore && window.AppCore.Validation;
  if (validation && !validation.validateFields(form, [
    {
      input: "#regName",
      validate: function(value) {
        return validation.normalizeText(value).length >= 2 ? "" : "Họ và tên phải có ít nhất 2 ký tự.";
      }
    },
    {
      input: "#regEmail",
      validate: function(value) {
        return validation.isValidEmail(value) ? "" : "Email không đúng định dạng.";
      }
    },
    {
      input: "#regPhone",
      validate: function(value) {
        return validation.isValidPhone(value) ? "" : "Số điện thoại không hợp lệ.";
      }
    },
    {
      input: "#regPassword",
      validate: function(value) {
        return String(value || "").trim().length >= 6 ? "" : "Mật khẩu phải có ít nhất 6 ký tự.";
      }
    }
  ])) {
    return;
  }

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const pass = document.getElementById("regPassword").value;

  const errorMsg = document.getElementById("regErrorMsg");
  const btn = document.getElementById("btnRegSubmit");

  btn.innerText = "Đang đăng ký...";
  btn.style.opacity = "0.7";

  try {
    const response = await fetch("https://localhost:7082/api/Auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: name,
        email: email,
        phone: phone,
        password: pass,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Đăng ký thất bại. Vui lòng thử lại.");
    }

    if (window.AppCore && typeof window.AppCore.toast === "function") {
      window.AppCore.toast(
        "Đăng ký thành công!",
      );
    }

    fetch("https://localhost:7082/api/Customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: name,
        email: email,
        phoneNumber: phone,
        identityCard: null,
        status: "Khách mới",
        aiPreferences: null
      })
    }).catch(() => {});

    setTimeout(() => {
      const registerForm = document.getElementById("registerForm") || form;
      const loginEmailInput = document.getElementById("loginEmail");
      const loginPasswordInput = document.getElementById("loginPassword");
      closeRegisterModal();
      openLoginModal();
      if (registerForm && typeof registerForm.reset === "function") {
        registerForm.reset();
      }
      if (errorMsg) {
        errorMsg.innerText = "";
        errorMsg.style.display = "none";
      }
      if (loginEmailInput) {
        loginEmailInput.value = email;
      }
      if (loginPasswordInput) {
        loginPasswordInput.value = "";
        loginPasswordInput.focus();
      }
    }, 300);
  } catch (error) {
    errorMsg.innerText = error.message;
    errorMsg.style.display = "block";
  } finally {
    btn.innerText = "Đăng ký";
    btn.style.opacity = "1";
  }
}

function openLoginModal() {
  document.getElementById("loginModal").style.display = "flex";
  document.getElementById("loginErrorMsg").style.display = "none";
}
function closeLoginModal() {
  document.getElementById("loginModal").style.display = "none";
}

function extractRoleFromToken(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return "";
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, function(char) {
      return char.charCodeAt(0);
    });
    const decoded = JSON.parse(new TextDecoder("utf-8").decode(bytes));
    
    const role = String(
      decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
      || decoded.role
      || ""
    ).trim();
    
    return role;
  } catch (e) {
    return "";
  }
}

function isReceptionistRoleValue(role) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
  return normalized === "letan"
    || normalized === "receptionist"
    || normalized === "staff"
    || normalized === "employee"
    || normalized === "nhanvien";
}

function setStoredCustomerSession(info) {
  try {
    const accountId = info && (info.accountId || info.AccountId || info.id || info.Id || "");
    const customerId = info && (info.customerId || info.CustomerId || "");
    const fullName = info && (info.fullName || info.FullName || info.name || "");
    const phone = info && (info.phoneNumber || info.PhoneNumber || info.phone || "");

    if (accountId !== undefined && accountId !== null && String(accountId).trim()) {
      localStorage.setItem("accountId", String(accountId));
    }
    if (customerId !== undefined && customerId !== null && String(customerId).trim()) {
      localStorage.setItem("customerId", String(customerId));
    }
    if (String(fullName || "").trim()) {
      localStorage.setItem("customerName", String(fullName).trim());
    }
    if (String(phone || "").trim()) {
      localStorage.setItem("customerPhone", String(phone).trim());
    }
  } catch (e) {}
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const validation = window.AppCore && window.AppCore.Validation;
  if (validation && !validation.validateFields(form, [
    {
      input: "#loginEmail",
      validate: function(value) {
        return validation.isValidEmail(value) ? "" : "Email không đúng định dạng.";
      }
    },
    {
      input: "#loginPassword",
      validate: function(value) {
        return String(value || "").trim() ? "" : "Vui lòng nhập mật khẩu.";
      }
    }
  ])) {
    return;
  }

  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;
  const errorMsg = document.getElementById("loginErrorMsg");
  const btn = document.getElementById("btnLoginSubmit");


  errorMsg.style.display = "none";
  btn.innerText = "Đang đăng nhập...";
  btn.style.opacity = "0.7";
  btn.disabled = true;

  try {
    const response = await fetch("https://localhost:7082/api/Auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        password: pass,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.",
      );
    }

    
    if (window.AppCore && typeof window.AppCore.toast === "function") {
      window.AppCore.toast("Đăng nhập thành công!");
    }

    if (window.AppCore && typeof window.AppCore.setAuthSession === "function") {
      window.AppCore.setAuthSession(data.token, data.refreshToken, email);
    } else {
      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("userEmail", email);
    }


    await (async function syncCustomerInfo() {
      try {
        const tokenVal = data.token || localStorage.getItem('token');
        if (!tokenVal) return;

        const accRes = await fetch('https://localhost:7082/api/Accounts/me', {
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenVal }
        });

        if (!accRes.ok) return;
        const acc = await accRes.json();
        const accountId = acc.id || acc.Id || '';
        const phone = acc.phoneNumber || acc.PhoneNumber || '';
        const fullName = acc.fullName || acc.FullName || acc.Fullname || acc.FullName;

        setStoredCustomerSession({
          accountId: accountId,
          fullName: fullName,
          phoneNumber: phone
        });

        if (!phone) return;

        const params = new URLSearchParams({ phone: phone.replace(/\s+/g, '') });
        const custRes = await fetch('https://localhost:7082/api/Customers/public/by-phone?' + params.toString(), {
          headers: { 'Content-Type': 'application/json' }
        });

        if (custRes.status === 200) {
          const cust = await custRes.json();
          setStoredCustomerSession({
            accountId: accountId,
            customerId: cust.id || cust.Id || '',
            fullName: cust.fullName || cust.FullName || fullName || '',
            phoneNumber: cust.phoneNumber || cust.PhoneNumber || phone || ''
          });
        } else if (custRes.status === 404) {
          try {
            const createRes = await fetch('https://localhost:7082/api/Customers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fullName: fullName || email, email: email, phoneNumber: phone, identityCard: null, loyaltyTier: 'Khách mới', status: 'Khách mới', aiPreferences: null })
            });
            if (createRes.ok) {
              const created = await createRes.json();
              setStoredCustomerSession({
                accountId: accountId,
                customerId: created.id || created.Id || '',
                fullName: created.fullName || created.FullName || fullName || '',
                phoneNumber: created.phoneNumber || created.PhoneNumber || phone || ''
              });
            }
          } catch (e) {}
        }
      } catch (e) {}
    })();

    try {
      var role = extractRoleFromToken(data.token);
      var roleNorm = String(role || "").trim().toLowerCase();
      

      if (String(roleNorm || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase() === 'admin') {
        window.location.replace("dashboard.html");
      } else if (isReceptionistRoleValue(role) || Boolean(window.AppCore?.isReceptionistRole?.(role))) {
        window.location.replace("booking.html");
      } else {
        window.location.replace("index.html");
      }
    } catch (e) {
      window.location.replace("index.html");
    }
  } catch (error) {
    errorMsg.innerText = error.message;
    errorMsg.style.display = "block";
  } finally {
    btn.innerText = "Đăng nhập";
    btn.style.opacity = "1";
    btn.disabled = false;
  }
}

window.addEventListener("scroll", () => {
  const nav = document.getElementById("navbar");
  if (window.scrollY > 50) {
    nav.classList.add("scrolled");
  } else {
    nav.classList.remove("scrolled");
  }
});
