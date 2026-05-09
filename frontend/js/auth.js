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
  const name = document.getElementById("regName").value;
  const email = document.getElementById("regEmail").value;
  const phone = document.getElementById("regPhone").value;
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
        "Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.",
      );
    }

    setTimeout(() => {
      closeRegisterModal();
      openLoginModal();
    }, 700);
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
    const decoded = JSON.parse(atob(normalized));
    return String(
      decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
      || decoded.role
      || ""
    ).trim();
  } catch (_) {
    return "";
  }
}

function isReceptionistRoleValue(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "lễ tân"
    || normalized === "le tan"
    || normalized === "letan"
    || normalized === "receptionist"
    || normalized === "staff"
    || normalized === "employee";
}

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
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
    
    try {
      var role = extractRoleFromToken(data.token);
      var isReceptionist = isReceptionistRoleValue(role)
        || Boolean(window.AppCore?.isReceptionistRole?.(role));
      if (isReceptionist) {
        window.location.replace("booking.html");
      } else {
        window.location.replace("dashboard.html");
      }
    } catch (e) {
      window.location.replace("dashboard.html");
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
