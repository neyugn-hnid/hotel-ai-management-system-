document.addEventListener('DOMContentLoaded', () => {
  const AUTH_API_URL = 'https://localhost:7082/api/Auth/login';
  const ACCOUNT_API_URL = 'https://localhost:7082/api/Accounts';
  

  const bankIdEl = document.getElementById('bankId');
  const accountNoEl = document.getElementById('accountNo');
  const accountNameEl = document.getElementById('accountName');
  const btnSaveBank = document.getElementById('btnSaveBank');
  
  const profileFullNameEl = document.getElementById('profileFullName');
  const profileEmailEl = document.getElementById('profileEmail');
  const profilePhoneEl = document.getElementById('profilePhone');
  const profileRoleEl = document.getElementById('profileRole');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  
  const currentPasswordEl = document.getElementById('currentPassword');
  const newPasswordEl = document.getElementById('newPassword');
  const confirmPasswordEl = document.getElementById('confirmPassword');
  const btnSavePassword = document.getElementById('btnSavePassword');
  
  const logoTextEl = document.getElementById('globalLogoText');
  const addressEl = document.getElementById('globalAddress');
  const phoneEl = document.getElementById('globalPhone');
  const emailEl = document.getElementById('globalEmail');
  const btnSaveGlobal = document.getElementById('btnSaveGlobal');
  
  const pageTitleEl = document.getElementById('settingsPageTitle');
  const pageDescriptionEl = document.getElementById('settingsPageDescription');
  
  const auth = window.AppCore?.getAuthContext?.() || { role: '', fullName: '', email: '' };
  const isAdmin = window.AppCore?.isAdminRole?.(auth.role);
  let currentAccount = null;


  profileFullNameEl.value = auth.fullName || '';
  profileEmailEl.value = auth.email || '';
  profileRoleEl.textContent = auth.role || 'Chưa có thông tin';

  if (!isAdmin) {
    document.querySelectorAll('[data-admin-only]').forEach((section) => {
      section.style.display = 'none';
    });
    pageTitleEl.textContent = 'Cài đặt cá nhân';
    pageDescriptionEl.textContent = 'Quản lý thông tin tài khoản và đổi mật khẩu.';
  }


  async function extractApiError(response, fallbackMessage) {
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return data.message || data.title || fallbackMessage;
      }

      const text = await response.text();
      return text || fallbackMessage;
    } catch (_) {
      return fallbackMessage;
    }
  }

  async function fetchCurrentAccount() {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Bạn chưa đăng nhập.');
    }

    const response = await fetch(ACCOUNT_API_URL + '/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      }
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Không thể tải thông tin tài khoản.'));
    }

    return await response.json();
  }

  async function verifyCurrentPassword(email, password) {
    const response = await fetch(AUTH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    if (!response.ok) {
      throw new Error('Mật khẩu hiện tại không đúng.');
    }

    return response.json();
  }

  function normalizeAccountProfile(raw) {
    return {
      id: raw && raw.id ? String(raw.id) : '',
      fullName: raw && raw.fullName ? raw.fullName : '',
      email: raw && raw.email ? raw.email : '',
      phoneNumber: raw && raw.phoneNumber ? raw.phoneNumber : '',
      role: raw && raw.role ? raw.role : (auth.role || 'Receptionist'),
      status: raw && raw.status ? raw.status : 'Hoạt động'
    };
  }

  async function syncCurrentAccountProfile() {
    currentAccount = normalizeAccountProfile(await fetchCurrentAccount());
    profileFullNameEl.value = currentAccount.fullName || profileFullNameEl.value;
    profileEmailEl.value = currentAccount.email || profileEmailEl.value;
    profilePhoneEl.value = currentAccount.phoneNumber || '';
    profileRoleEl.textContent = currentAccount.role || profileRoleEl.textContent;
  }

  function setButtonLoading(btn, isLoading) {
    const originalHTML = btn.innerHTML;
    if (isLoading) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span class="material-symbols-outlined setting-save-icon">progress_activity</span> Đang lưu...';
      btn.dataset.originalHTML = originalHTML;
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = btn.dataset.originalHTML || originalHTML;
    }
  }


  const settings = JSON.parse(localStorage.getItem('luxe_bank_settings') || '{}');
  if (settings.bankId) bankIdEl.value = settings.bankId;
  if (settings.accountNo) accountNoEl.value = settings.accountNo;
  if (settings.accountName) accountNameEl.value = settings.accountName;

  const globalSettings = JSON.parse(localStorage.getItem('luxe_global_settings') || '{}');
  if (globalSettings.logoText) logoTextEl.value = globalSettings.logoText;
  if (globalSettings.address) addressEl.value = globalSettings.address;
  if (globalSettings.phone) phoneEl.value = globalSettings.phone;
  if (globalSettings.email) emailEl.value = globalSettings.email;

  syncCurrentAccountProfile().catch((error) => {
    window.AppCore?.toast?.(error.message || 'Không thể tải thông tin tài khoản.', 'error');
  });


  if (btnSaveBank) {
    btnSaveBank.addEventListener('click', async () => {
      setButtonLoading(btnSaveBank, true);
      try {
        const newBankSettings = {
          bankId: bankIdEl.value,
          accountNo: accountNoEl.value,
          accountName: accountNameEl.value
        };
        localStorage.setItem('luxe_bank_settings', JSON.stringify(newBankSettings));
        window.AppCore?.toast?.('Đã lưu cài đặt VietQR.', 'success');
      } catch (error) {
        window.AppCore?.toast?.(error.message || 'Không thể lưu cài đặt.', 'error');
      } finally {
        setButtonLoading(btnSaveBank, false);
      }
    });
  }


  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
      const fullName = profileFullNameEl.value.trim();
      const nextEmail = profileEmailEl.value.trim();
      const nextPhone = profilePhoneEl.value.trim();

      if (!fullName) {
        window.AppCore?.toast?.('Vui lòng nhập họ và tên.', 'error');
        return;
      }

      if (!nextEmail) {
        window.AppCore?.toast?.('Vui lòng nhập email.', 'error');
        return;
      }

      setButtonLoading(btnSaveProfile, true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Bạn chưa đăng nhập.');
        }

        const payload = {
          fullName: fullName,
          email: nextEmail,
          phoneNumber: nextPhone
        };

        const profileResponse = await fetch(ACCOUNT_API_URL + '/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify(payload)
        });

        if (!profileResponse.ok) {
          throw new Error(await extractApiError(profileResponse, 'Không thể cập nhật tài khoản.'));
        }

        currentAccount = normalizeAccountProfile((await profileResponse.json()).account || {
          id: currentAccount && currentAccount.id,
          fullName: fullName,
          email: nextEmail,
          phoneNumber: nextPhone,
          role: currentAccount && currentAccount.role,
          status: currentAccount && currentAccount.status
        });

        localStorage.setItem('userEmail', nextEmail);
        window.AppCore?.toast?.('Đã cập nhật thông tin cá nhân.', 'success');
      } catch (error) {
        window.AppCore?.toast?.(error.message || 'Không thể lưu thay đổi.', 'error');
      } finally {
        setButtonLoading(btnSaveProfile, false);
      }
    });
  }


  if (btnSavePassword) {
    btnSavePassword.addEventListener('click', async () => {
      const currentPass = currentPasswordEl.value;
      const newPass = newPasswordEl.value;
      const confirmPass = confirmPasswordEl.value;
      const originalEmail = ((currentAccount && currentAccount.email) || auth.email || '').trim();

      if (!currentPass) {
        window.AppCore?.toast?.('Vui lòng nhập mật khẩu hiện tại.', 'error');
        return;
      }

      if (!newPass) {
        window.AppCore?.toast?.('Vui lòng nhập mật khẩu mới.', 'error');
        return;
      }

      if (newPass !== confirmPass) {
        window.AppCore?.toast?.('Mật khẩu mới không khớp.', 'error');
        return;
      }

      if (newPass.length < 6) {
        window.AppCore?.toast?.('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
        return;
      }

      setButtonLoading(btnSavePassword, true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Bạn chưa đăng nhập.');
        }

        const payload = {
          fullName: profileFullNameEl.value,
          email: profileEmailEl.value,
          phoneNumber: profilePhoneEl.value,
          currentPassword: currentPass,
          newPassword: newPass,
          confirmPassword: confirmPass
        };

        const response = await fetch(ACCOUNT_API_URL + '/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(await extractApiError(response, 'Không thể đổi mật khẩu.'));
        }


        const relogin = await verifyCurrentPassword(originalEmail, newPass);
        if (relogin && relogin.token) {
          localStorage.setItem('token', relogin.token);
        }

        currentPasswordEl.value = '';
        newPasswordEl.value = '';
        confirmPasswordEl.value = '';

        window.AppCore?.toast?.('Đã đổi mật khẩu thành công.', 'success');
      } catch (error) {
        window.AppCore?.toast?.(error.message || 'Không thể đổi mật khẩu.', 'error');
      } finally {
        setButtonLoading(btnSavePassword, false);
      }
    });
  }

  if (btnSaveGlobal) {
    btnSaveGlobal.addEventListener('click', async () => {
      setButtonLoading(btnSaveGlobal, true);
      try {
        const newGlobalSettings = {
          logoText: logoTextEl.value,
          address: addressEl.value,
          phone: phoneEl.value,
          email: emailEl.value
        };
        localStorage.setItem('luxe_global_settings', JSON.stringify(newGlobalSettings));
        window.AppCore?.toast?.('Đã lưu cài đặt giao diện.', 'success');
      } catch (error) {
        window.AppCore?.toast?.(error.message || 'Không thể lưu cài đặt.', 'error');
      } finally {
        setButtonLoading(btnSaveGlobal, false);
      }
    });
  }
});

function togglePassword(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    iconEl.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    iconEl.textContent = 'visibility';
  }
}
