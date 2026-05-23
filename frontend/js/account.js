let accounts = [];
let deleteId = null;

const ACCOUNT_API_URL = 'https://localhost:7082/api/Accounts';
const FALLBACK_AVATAR_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

let searchInput;
let filterRole;
let filterStatus;
let sortAccounts;

const queryState = {
  q: '',
  role: '',
  status: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  pageNumber: 1,
  pageSize: 10
};

const pagingState = {
  totalCount: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
};

function pickAvatarColor(seed) {
  const source = String(seed || 'default');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }

  const idx = Math.abs(hash) % FALLBACK_AVATAR_COLORS.length;
  return FALLBACK_AVATAR_COLORS[idx];
}

function getInitials(name) {
  const safeName = String(name || '').trim();
  if (!safeName) return '?';
  return safeName.charAt(0).toUpperCase();
}

function normalizeStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active' || normalized === 'hoạt động') {
    return 'Hoạt động';
  }
  return 'Khóa';
}

function encodeHtmlText(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text || '').replace(/[&<>"']/g, function(char) {
    return map[char];
  });
}

function translateRole(role) {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  if (normalized === 'admin') return 'Quản trị viên';
  if (normalized === 'receptionist' || normalized === 'le tan' || normalized === 'letan') return 'Lễ tân';
  if (normalized === 'customer' || normalized === 'khach' || normalized === 'guest') return 'Khách';
  return role;
}

function formatLastLogin(lastLoginAt) {
  if (!lastLoginAt) return 'Chưa đăng nhập';

  const date = new Date(lastLoginAt);
  if (Number.isNaN(date.getTime())) return 'Chưa đăng nhập';

  return date.toLocaleString('vi-VN', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeAccount(raw) {
  return {
    id: String(raw.id ?? ''),
    name: raw.fullName || 'Chưa có tên',
    email: raw.email || '',
    phoneNumber: raw.phoneNumber || '',
    role: String(raw.role || 'Customer').trim(),
    status: normalizeStatus(raw.status),
    lastLogin: formatLastLogin(raw.lastLoginAt),
    avatar: '',
    color: raw.avatarColor || pickAvatarColor(raw.email || raw.id)
  };
}


function showToast(message, variant) {
  if (window.AppCore && typeof window.AppCore.toast === 'function') {
    window.AppCore.toast(message, variant);
  }
}

async function extractApiError(response, fallbackMessage) {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data.message || data.title || fallbackMessage;
    }

    const text = await response.text();
    return text && text.trim() ? text : fallbackMessage;
  } catch (_) {
    return fallbackMessage;
  }
}

function parseSortValue(value) {
  const [sortBy, sortDir] = String(value || 'updatedAt_desc').split('_');
  queryState.sortBy = sortBy || 'updatedAt';
  queryState.sortDir = sortDir || 'desc';
}

async function loadAccountsFromApi() {
  const token = localStorage.getItem('token');

  if (!token) {
    accounts = [];
    pagingState.totalCount = 0;
    pagingState.totalPages = 1;
    pagingState.hasNextPage = false;
    pagingState.hasPreviousPage = false;
    showToast('Bạn chưa đăng nhập.', 'error');
    return;
  }

  try {
    const params = new URLSearchParams();
    if (queryState.q) params.set('q', queryState.q);
    if (queryState.role) params.set('role', queryState.role);
    if (queryState.status) params.set('status', queryState.status);
    params.set('sortBy', queryState.sortBy);
    params.set('sortDir', queryState.sortDir);
    params.set('pageNumber', String(queryState.pageNumber));
    params.set('pageSize', String(queryState.pageSize));

    const response = await fetch(ACCOUNT_API_URL + '?' + params.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('HTTP ' + response.status + ': ' + (errorText || 'Không thể tải danh sách tài khoản.'));
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
    accounts = items.map(normalizeAccount);

    pagingState.totalCount = Number(data.totalCount || accounts.length || 0);
    pagingState.totalPages = Math.max(1, Number(data.totalPages || 1));
    pagingState.hasNextPage = Boolean(data.hasNextPage);
    pagingState.hasPreviousPage = Boolean(data.hasPreviousPage);
  } catch (error) {
    accounts = [];
    pagingState.totalCount = 0;
    pagingState.totalPages = 1;
    pagingState.hasNextPage = false;
    pagingState.hasPreviousPage = false;
    showToast(error.message || 'Lỗi tải tài khoản.', 'error');
  }
}

async function loadAndRenderAccounts() {
  await loadAccountsFromApi();

  if (queryState.pageNumber > pagingState.totalPages) {
    queryState.pageNumber = pagingState.totalPages;
    await loadAccountsFromApi();
  }

  renderAccounts();
}

function renderAccounts() {
  const tbody = document.getElementById('accountTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  accounts.forEach(function (acc) {
    const tr = document.createElement('tr');
    tr.className = 'tbl-row';

    let avatarHtml = '';
    if (acc.avatar) {
      avatarHtml = '<img src="' + acc.avatar + '" alt="Avatar" class="account-avatar-image"/>';
    } else {
      avatarHtml = '<div class="avatar-circle account-avatar-fallback" style="background:' + acc.color + ';">' + getInitials(acc.name) + '</div>';
    }

    let roleBadge = '';
    const roleLabel = translateRole(acc.role);
    const isAdmin = String(acc.role || '').toLowerCase() === 'admin';
    if (isAdmin) {
      roleBadge = '<span class="account-role-badge account-role-badge--admin">' + encodeHtmlText(roleLabel) + '</span>';
    } else {
      roleBadge = '<span class="account-role-badge account-role-badge--default">' + encodeHtmlText(roleLabel) + '</span>';
    }

    let statusBadge = '';
    if (acc.status === 'Hoạt động') {
      statusBadge = '<span class="account-status-badge account-status-badge--active"><span class="dot account-status-badge__dot account-status-badge__dot--active"></span> Hoạt động</span>';
    } else {
      statusBadge = '<span class="account-status-badge account-status-badge--locked"><span class="dot account-status-badge__dot account-status-badge__dot--locked"></span> Khóa</span>';
    }

    let actionsHtml = '<button class="btn-notion-sec account-action-btn" title="Chỉnh sửa" onclick="editAccount(\'' + acc.id + '\')"><span class="material-symbols-outlined account-action-btn__icon account-action-btn__icon--edit">edit</span></button>';
    if (!isAdmin) {
      if (acc.status === 'Hoạt động') {
        actionsHtml += '<button class="btn-notion-sec account-action-btn account-action-btn--danger" title="Khóa tài khoản" onclick="toggleStatus(\'' + acc.id + '\')"><span class="material-symbols-outlined account-action-btn__icon account-action-btn__icon--danger">lock</span></button>';
      } else {
        actionsHtml += '<button class="btn-notion-sec account-action-btn account-action-btn--success" title="Mở khóa" onclick="toggleStatus(\'' + acc.id + '\')"><span class="material-symbols-outlined account-action-btn__icon account-action-btn__icon--success">lock_open</span></button>';
      }
      actionsHtml += '<button class="btn-notion-sec account-action-btn account-action-btn--danger" title="Xóa tài khoản" onclick="openDeleteModal(\'' + acc.id + '\')"><span class="material-symbols-outlined account-action-btn__icon account-action-btn__icon--danger">delete</span></button>';
    }

    tr.innerHTML = '\
      <td class="account-cell account-cell--profile">\
        <div class="account-profile-cell">\
          ' + avatarHtml + '\
          <div class="account-profile-copy">\
            <p class="account-profile-name">' + encodeHtmlText(acc.name) + '</p>\
            <p class="account-profile-email">' + encodeHtmlText(acc.email) + '</p>\
          </div>\
        </div>\
      </td>\
      <td class="account-cell account-cell--role">' + roleBadge + '</td>\
      <td class="account-cell account-cell--status">' + statusBadge + '</td>\
      <td class="account-cell account-cell--last-login">' + encodeHtmlText(acc.lastLogin) + '</td>\
      <td class="account-cell account-cell--actions">\
        <div class="account-action-group">\
          ' + actionsHtml + '\
        </div>\
      </td>';

    tbody.appendChild(tr);
  });

  const statTotal = document.getElementById('stat-total');
  if (statTotal) statTotal.innerText = String(pagingState.totalCount);

  const statAdmin = document.getElementById('stat-admin');
  if (statAdmin) {
    statAdmin.innerText = String(accounts.filter(function (acc) {
      return String(acc.role || '').toLowerCase() === 'admin';
    }).length);
  }

  const statLocked = document.getElementById('stat-locked');
  if (statLocked) {
    statLocked.innerText = String(accounts.filter(function (acc) {
      return acc.status === 'Khóa';
    }).length);
  }

  const currentCount = document.getElementById('currentCount');
  if (currentCount) currentCount.innerText = String(pagingState.totalCount);

  const pageInfo = document.getElementById('accountPageInfo');
  if (pageInfo) {
    pageInfo.innerText = 'Trang ' + queryState.pageNumber + '/' + pagingState.totalPages;
  }

  const prevBtn = document.getElementById('btnPrevAccounts');
  if (prevBtn) prevBtn.disabled = !pagingState.hasPreviousPage;

  const nextBtn = document.getElementById('btnNextAccounts');
  if (nextBtn) nextBtn.disabled = !pagingState.hasNextPage;
}

function openAddModal() {
  const title = document.getElementById('modalTitle');
  if (title) title.innerText = 'Thêm tài khoản';

  const form = document.getElementById('accountForm');
  if (form) form.reset();

  const idInput = document.getElementById('accId');
  if (idInput) idInput.value = '';

  const statusRow = document.getElementById('statusRow');
  if (statusRow) statusRow.style.display = 'none';

  const passInput = document.getElementById('accPassword');
  if (passInput) {
    passInput.required = true;
    passInput.value = '';
  }

  const passHelp = document.getElementById('passwordHelp');
  if (passHelp) passHelp.innerText = '';

  const modal = document.getElementById('accountModal');
  if (modal) modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('accountModal');
  if (modal) modal.style.display = 'none';
}

function openDeleteModal(id) {
  deleteId = id;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
  deleteId = null;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'none';
}

async function confirmDelete() {
  if (!deleteId) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(ACCOUNT_API_URL + '/' + deleteId, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer ' + token
      }
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Xóa tài khoản thất bại.'));
    }

    closeDeleteModal();
    await loadAndRenderAccounts();
    showToast('Đã xóa tài khoản.');
  } catch (error) {
    showToast(error.message || 'Không thể xóa tài khoản.', 'error');

  }
}

function editAccount(id) {
  const acc = accounts.find(function (item) {
    return item.id === id;
  });
  if (!acc) return;

  const title = document.getElementById('modalTitle');
  if (title) title.innerText = 'Chỉnh sửa tài khoản';

  document.getElementById('accId').value = acc.id;
  document.getElementById('accName').value = acc.name;
  document.getElementById('accEmail').value = acc.email;
  document.getElementById('accPhone').value = acc.phoneNumber || '';
  document.getElementById('accRole').value = acc.role;
  document.getElementById('accStatus').value = acc.status;

  const statusRow = document.getElementById('statusRow');
  if (statusRow) statusRow.style.display = 'block';

  const passInput = document.getElementById('accPassword');
  if (passInput) {
    passInput.value = '';
    passInput.required = false;
  }

  const passHelp = document.getElementById('passwordHelp');
  if (passHelp) passHelp.innerText = '(Để trống nếu không muốn đổi)';

  const modal = document.getElementById('accountModal');
  if (modal) modal.style.display = 'flex';
}

async function toggleStatus(id) {
  try {
    const token = localStorage.getItem('token');

    const res = await fetch(ACCOUNT_API_URL + '/' + id + '/toggle-status', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + token
      }
    });

    if (!res.ok) {
      throw new Error(await extractApiError(res, 'Lỗi cập nhật trạng thái.'));
    }

    await loadAndRenderAccounts();
    showToast('Cập nhật trạng thái thành công');
  } catch (err) {
    showToast(err.message || 'Không thể cập nhật trạng thái.', 'error');

  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const validation = window.AppCore && window.AppCore.Validation;

  const id = document.getElementById('accId').value;
  if (validation && !validation.validateFields(form, [
    {
      input: '#accName',
      validate: function(value) {
        return validation.normalizeText(value).length >= 2 ? '' : 'Họ và tên phải có ít nhất 2 ký tự.';
      }
    },
    {
      input: '#accEmail',
      validate: function(value) {
        return validation.isValidEmail(value) ? '' : 'Email không đúng định dạng.';
      }
    },
    {
      input: '#accPhone',
      validate: function(value) {
        if (!String(value || '').trim()) return '';
        return validation.isValidPhone(value) ? '' : 'Số điện thoại không hợp lệ.';
      }
    },
    {
      input: '#accPassword',
      validate: function(value) {
        if (!id && String(value || '').trim().length < 6) {
          return 'Mật khẩu phải có ít nhất 6 ký tự.';
        }
        if (id && String(value || '').trim() && String(value || '').trim().length < 6) {
          return 'Mật khẩu mới phải có ít nhất 6 ký tự.';
        }
        return '';
      }
    },
    {
      input: '#accRole',
      validate: function(value) {
        return validation.normalizeText(value) ? '' : 'Vui lòng chọn vai trò.';
      }
    },
    {
      input: '#accStatus',
      validate: function(value) {
        return !id || validation.normalizeText(value) ? '' : 'Vui lòng chọn trạng thái.';
      }
    }
  ])) {
    return;
  }

  const name = document.getElementById('accName').value.trim();
  const email = document.getElementById('accEmail').value.trim();
  const phoneNumber = document.getElementById('accPhone').value.trim();
  const password = document.getElementById('accPassword').value;
  const role = document.getElementById('accRole').value;
  const status = id ? document.getElementById('accStatus').value : 'Hoạt động';

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Bạn chưa đăng nhập.', 'error');
      return;
    }

    const payload = {
      fullName: name,
      email: email,
      phoneNumber: phoneNumber,
      password: password,
      role: role,
      status: status
    };

    let url = ACCOUNT_API_URL;
    let method = 'POST';

    if (id) {
      url += '/' + id;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Lỗi khi lưu tài khoản.'));
    }

    showToast(id ? 'Cập nhật tài khoản thành công!' : 'Thêm tài khoản thành công!');
    await loadAndRenderAccounts();
  } catch (error) {
    showToast(error.message || 'Lỗi khi lưu tài khoản.', 'error');

    return;
  }

  closeModal();
}

document.addEventListener('DOMContentLoaded', async function () {
  await loadLookups();

  searchInput = document.getElementById('searchInput');
  filterRole = document.getElementById('filterRole');
  filterStatus = document.getElementById('filterStatus');
  sortAccounts = document.getElementById('sortAccounts');

  if (searchInput) {
    const onSearch = window.AppCore && typeof window.AppCore.debounce === 'function'
      ? window.AppCore.debounce(async function () {
          queryState.q = searchInput.value.trim();
          queryState.pageNumber = 1;
          await loadAndRenderAccounts();
        }, 300)
      : async function () {
          queryState.q = searchInput.value.trim();
          queryState.pageNumber = 1;
          await loadAndRenderAccounts();
        };

    searchInput.addEventListener('input', onSearch);
  }

  if (filterRole) {
    filterRole.addEventListener('change', async function () {
      queryState.role = filterRole.value;
      queryState.pageNumber = 1;
      await loadAndRenderAccounts();
    });
  }

  if (filterStatus) {
    filterStatus.addEventListener('change', async function () {
      queryState.status = filterStatus.value;
      queryState.pageNumber = 1;
      await loadAndRenderAccounts();
    });
  }

  if (sortAccounts) {
    sortAccounts.addEventListener('change', async function () {
      parseSortValue(sortAccounts.value);
      queryState.pageNumber = 1;
      await loadAndRenderAccounts();
    });
  }

  const addBtn = document.getElementById('btnAddAccount');
  if (addBtn) addBtn.addEventListener('click', openAddModal);

  const form = document.getElementById('accountForm');
  if (form) form.addEventListener('submit', handleFormSubmit);

  const prevBtn = document.getElementById('btnPrevAccounts');
  if (prevBtn) {
    prevBtn.addEventListener('click', async function () {
      if (!pagingState.hasPreviousPage) return;
      queryState.pageNumber -= 1;
      await loadAndRenderAccounts();
    });
  }

  const nextBtn = document.getElementById('btnNextAccounts');
  if (nextBtn) {
    nextBtn.addEventListener('click', async function () {
      if (!pagingState.hasNextPage) return;
      queryState.pageNumber += 1;
      await loadAndRenderAccounts();
    });
  }

  await loadAndRenderAccounts();
});

async function loadLookups() {
  const LOOKUPS_API = 'https://localhost:7082/api/Lookups';
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(LOOKUPS_API, { headers });
    if (!res.ok) return;
    const data = await res.json();
    _populateSelect('filterRole', data.accountRoles, 'Tất cả vai trò', '');
    _populateSelect('filterStatus', data.accountStatuses, 'Tất cả trạng thái', '');
    _populateSelect('accRole', [
      { value: 'Admin', label: 'Quản trị viên' },
      { value: 'Receptionist', label: 'Lễ tân' }
    ]);
    _populateSelect('accStatus', data.accountStatuses);
  } catch (e) {}
}

function _populateSelect(elId, items, defaultLabel, defaultValue) {
  var el = document.getElementById(elId);
  if (!el || !items) return;
  var firstOpt = el.options[0];
  var keepAll = firstOpt && (firstOpt.value === '' || firstOpt.value === 'All');
  el.innerHTML = '';
  if (keepAll) {
    var opt = document.createElement('option');
    opt.value = defaultValue != null ? defaultValue : '';
    opt.textContent = defaultLabel || 'Tất cả';
    el.appendChild(opt);
  }
  items.forEach(function(item) {
    var opt = document.createElement('option');
    opt.value = typeof item === 'string' ? item : item.value;
    opt.textContent = typeof item === 'string' ? item : item.label;
    el.appendChild(opt);
  });
}
