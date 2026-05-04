let customersData = [];

let currentEditId = null;
let customerToDelete = null;
const CUSTOMERS_API_URL = 'https://localhost:7082/api/Customers';
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&q=80';

const queryState = {
  q: '',
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

function showToast(message, variant) {
  if (window.AppCore && typeof window.AppCore.toast === 'function') {
    window.AppCore.toast(message, variant);
  }
}

function normalizeTier(tier) {
  const value = String(tier || '').toLowerCase();
  if (value === 'gold' || value === 'gold member') return 'Gold Member';
  if (value === 'elite' || value === 'elite suite') return 'Elite Suite';
  if (value === 'silver' || value === 'silver member') return 'Silver Member';
  if (value === 'khách mới' || value === 'new') return 'Khách mới';
  return tier || 'Khách mới';
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'đang lưu trú') return 'Đang lưu trú';
  if (value === 'đang trả phòng') return 'Đang trả phòng';
  if (value === 'đã rời đi') return 'Đã rời đi';
  return 'Đã rời đi';
}

function mapCustomer(raw) {
  return {
    id: Number(raw.id),
    name: raw.fullName || 'Khách chưa có tên',
    tier: normalizeTier(raw.loyaltyTier),
    cccd: raw.identityCard || '',
    phone: raw.phoneNumber || '',
    email: raw.email || '',
    bookings: 0,
    bookingsNote: '',
    status: normalizeStatus(raw.status),
    avatar: DEFAULT_AVATAR
  };
}

function buildPayload(id) {
  const name = document.getElementById('cusName').value;
  const cccd = document.getElementById('cusCCCD').value;
  const phone = document.getElementById('cusPhone').value;
  const status = document.getElementById('cusStatus').value;
  const tier = document.getElementById('cusTier').value;
  const existing = customersData.find(function (c) {
    return c.id === id;
  });

  return {
    id: id || 0,
    fullName: name,
    email: existing ? existing.email : '',
    phoneNumber: phone,
    identityCard: cccd,
    loyaltyTier: tier,
    status: status,
    aiPreferences: null
  };
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

async function fetchCustomers() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const params = new URLSearchParams();
  if (queryState.q) params.set('q', queryState.q);
  if (queryState.status) params.set('status', queryState.status);
  params.set('sortBy', queryState.sortBy);
  params.set('sortDir', queryState.sortDir);
  params.set('pageNumber', String(queryState.pageNumber));
  params.set('pageSize', String(queryState.pageSize));

  try {
    const response = await fetch(CUSTOMERS_API_URL + '?' + params.toString(), {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error('Không thể tải danh sách khách hàng.');
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);

    customersData = items.map(mapCustomer);
    pagingState.totalCount = Number(data.totalCount || customersData.length || 0);
    pagingState.totalPages = Math.max(1, Number(data.totalPages || 1));
    pagingState.hasNextPage = Boolean(data.hasNextPage);
    pagingState.hasPreviousPage = Boolean(data.hasPreviousPage);
  } catch (error) {
    customersData = [];
    pagingState.totalCount = 0;
    pagingState.totalPages = 1;
    pagingState.hasNextPage = false;
    pagingState.hasPreviousPage = false;
    showToast(error.message || 'Lỗi tải khách hàng.', 'error');
    console.error('Failed to fetch customers:', error);
  }
}

function getStatusStyle(status) {
  switch (status) {
    case 'Đang lưu trú': return { bg: '#f2f9ff', color: '#097fe8' };
    case 'Đang trả phòng': return { bg: '#f6f5f4', color: '#615d59' };
    case 'Đã rời đi': return { bg: '#f1f5f9', color: '#94a3b8' };
    default: return { bg: '#f1f5f9', color: '#615d59' };
  }
}

function renderCustomers() {
  const tbody = document.getElementById('customerTableBody');
  if (!tbody) return;

  tbody.innerHTML = customersData.map(function (customer) {
    const statusStyle = getStatusStyle(customer.status);
    const bookingsHtml = '<span style="font-weight: 600;">' + customer.bookings + '</span>';

    return '\
      <tr>\
        <td style="padding-left: 24px;">\
          <div style="display:flex; align-items:center; gap:12px;">\
            <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; background:#f1f5f9; flex-shrink:0; border: var(--notion-whisper);">\
              <img src="' + customer.avatar + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;"/>\
            </div>\
            <div>\
              <p style="font-weight:600; font-size: 14px;">' + customer.name + '</p>\
            </div>\
          </div>\
        </td>\
        <td>\
          <p style="font-size:13px; font-weight:600; color: var(--notion-blue); font-family: var(--f-mono);">' + customer.phone + '</p>\
        </td>\
        <td>\
          <div style="display:flex; align-items:center;">\
            ' + bookingsHtml + '\
          </div>\
        </td>\
        <td><span class="notion-pill" style="background:' + statusStyle.bg + '; color:' + statusStyle.color + ';">' + customer.status + '</span></td>\
        <td style="text-align:right; padding-right: 24px;">\
          <div style="display: flex; justify-content: flex-end; gap: 8px;">\
            <button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center;" onclick="openCustomerModal(' + customer.id + ')">\
              <span class="material-symbols-outlined" style="font-size:18px;">edit</span>\
            </button>\
            <button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center; color: #ef4444;" onclick="confirmDeleteCustomer(' + customer.id + ')">\
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>\
            </button>\
          </div>\
        </td>\
      </tr>';
  }).join('');

  const totalEl = document.getElementById('totalCustomers');
  if (totalEl) totalEl.innerText = String(pagingState.totalCount);

  const pageInfoEl = document.getElementById('customerPageInfo');
  if (pageInfoEl) {
    pageInfoEl.innerText = 'Trang ' + queryState.pageNumber + '/' + pagingState.totalPages;
  }

  const prevBtn = document.getElementById('btnPrevCustomers');
  if (prevBtn) prevBtn.disabled = !pagingState.hasPreviousPage;

  const nextBtn = document.getElementById('btnNextCustomers');
  if (nextBtn) nextBtn.disabled = !pagingState.hasNextPage;
}

async function loadAndRenderCustomers() {
  await fetchCustomers();

  if (queryState.pageNumber > pagingState.totalPages) {
    queryState.pageNumber = pagingState.totalPages;
    await fetchCustomers();
  }

  renderCustomers();
}

function openCustomerModal(id) {
  const modal = document.getElementById('customerModal');
  const title = document.getElementById('customerModalTitle');
  const form = document.getElementById('customerForm');

  if (id) {
    currentEditId = id;
    title.innerText = 'Chỉnh sửa khách hàng';
    const customer = customersData.find(function (c) {
      return c.id === id;
    });

    if (customer) {
      document.getElementById('cusName').value = customer.name;
      document.getElementById('cusCCCD').value = customer.cccd;
      document.getElementById('cusPhone').value = customer.phone;
      document.getElementById('cusTier').value = customer.tier;
      document.getElementById('cusStatus').value = customer.status;
    }
  } else {
    currentEditId = null;
    title.innerText = 'Thêm khách hàng mới';
    form.reset();
  }

  modal.style.display = 'flex';
}

function closeCustomerModal() {
  document.getElementById('customerModal').style.display = 'none';
}

async function saveCustomer(e) {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    if (currentEditId) {
      const response = await fetch(CUSTOMERS_API_URL + '/' + currentEditId, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(buildPayload(currentEditId))
      });

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Cập nhật khách hàng thất bại.'));
      }
      showToast('Cập nhật khách hàng thành công!');
    } else {
      const response = await fetch(CUSTOMERS_API_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(buildPayload(0))
      });

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Tạo khách hàng thất bại.'));
      }
      showToast('Tạo khách hàng thành công!');
    }

    closeCustomerModal();
    await loadAndRenderCustomers();
  } catch (error) {
    showToast(error.message || 'Không thể lưu khách hàng.', 'error');
    console.error('Failed to save customer:', error);
  }
}

function confirmDeleteCustomer(id) {
  customerToDelete = id;
  document.getElementById('deleteConfirmModal').style.display = 'flex';
}

function closeDeleteModal() {
  customerToDelete = null;
  document.getElementById('deleteConfirmModal').style.display = 'none';
}

async function deleteCustomer() {
  if (!customerToDelete) return;

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    const response = await fetch(CUSTOMERS_API_URL + '/' + customerToDelete, {
      method: 'DELETE',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Xóa khách hàng thất bại.'));
    }

    closeDeleteModal();
    await loadAndRenderCustomers();
    showToast('Xóa khách hàng thành công!');
  } catch (error) {
    showToast(error.message || 'Không thể xóa khách hàng.', 'error');
    console.error('Failed to delete customer:', error);
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  await loadLookups();

  const addBtn = document.getElementById('btnAddCustomer');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      openCustomerModal();
    });
  }

  const customerForm = document.getElementById('customerForm');
  if (customerForm) {
    customerForm.addEventListener('submit', saveCustomer);
  }

  const searchInput = document.getElementById('searchCustomers');
  if (searchInput) {
    const onSearch = window.AppCore && typeof window.AppCore.debounce === 'function'
      ? window.AppCore.debounce(async function () {
          queryState.q = searchInput.value.trim();
          queryState.pageNumber = 1;
          await loadAndRenderCustomers();
        }, 300)
      : async function () {
          queryState.q = searchInput.value.trim();
          queryState.pageNumber = 1;
          await loadAndRenderCustomers();
        };

    searchInput.addEventListener('input', onSearch);
  }

  const statusFilter = document.getElementById('filterStatus');
  if (statusFilter) {
    statusFilter.addEventListener('change', async function () {
      queryState.status = statusFilter.value;
      queryState.pageNumber = 1;
      await loadAndRenderCustomers();
    });
  }

  const sortSelect = document.getElementById('sortCustomers');
  if (sortSelect) {
    sortSelect.addEventListener('change', async function () {
      parseSortValue(sortSelect.value);
      queryState.pageNumber = 1;
      await loadAndRenderCustomers();
    });
  }

  const prevBtn = document.getElementById('btnPrevCustomers');
  if (prevBtn) {
    prevBtn.addEventListener('click', async function () {
      if (!pagingState.hasPreviousPage) return;
      queryState.pageNumber -= 1;
      await loadAndRenderCustomers();
    });
  }

  const nextBtn = document.getElementById('btnNextCustomers');
  if (nextBtn) {
    nextBtn.addEventListener('click', async function () {
      if (!pagingState.hasNextPage) return;
      queryState.pageNumber += 1;
      await loadAndRenderCustomers();
    });
  }

  await loadAndRenderCustomers();
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
    _populateSelect('filterStatus', data.customerStatuses, 'Tất cả trạng thái', '');
    _populateSelect('cusTier', ['Khách mới', 'Silver Member', 'Gold Member', 'Elite Suite']);
    _populateSelect('cusStatus', data.customerStatuses);
  } catch (e) { console.warn('Lookup load failed:', e); }
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
    opt.value = item;
    opt.textContent = item;
    el.appendChild(opt);
  });
}
