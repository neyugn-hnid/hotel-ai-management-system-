let servicesData = [];
let currentEditId = null;
let serviceToDelete = null;

const SERVICES_API_URL = 'https://localhost:7082/api/Services';

const queryState = {
  q: '',
  category: '',
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

function canManageServices() {
  return Boolean(window.AppCore && typeof window.AppCore.isAdminRole === 'function'
    && window.AppCore.isAdminRole(window.AppCore.getAuthContext().role));
}

function applyServiceRoleAccess() {
  const canManage = canManageServices();
  const addBtn = document.getElementById('btnAddService');
  const actionsHeader = document.getElementById('serviceActionsHeader');
  const submitBtn = document.getElementById('serviceSubmitButton');
  const deleteBtn = document.getElementById('serviceDeleteButton');

  if (addBtn) addBtn.style.display = canManage ? '' : 'none';
  if (actionsHeader) actionsHeader.style.display = canManage ? '' : 'none';
  if (submitBtn) submitBtn.style.display = canManage ? '' : 'none';
  if (deleteBtn) deleteBtn.style.display = canManage ? '' : 'none';
}

function showToast(message, variant) {
  if (window.AppCore && typeof window.AppCore.toast === 'function') {
    window.AppCore.toast(message, variant);
  }
}

function getStatusStyle(status) {
  switch (status) {
    case 'Hoạt động': return { bg: '#e7f3ef', color: '#0d7350' };
    case 'Tạm ngưng': return { bg: '#fee2e2', color: '#ef4444' };
    default: return { bg: '#f6f5f4', color: '#615d59' };
  }
}

function normalizeService(raw) {
  return {
    id: Number(raw.id),
    name: raw.serviceName || 'Dịch vụ',
    category: raw.category || 'Tiện ích & Khác',
    description: raw.description || '',
    price: Number(raw.price || 0),
    status: raw.status || 'Hoạt động'
  };
}

function parseSortValue(value) {
  if (value === 'asc') {
    queryState.sortBy = 'price';
    queryState.sortDir = 'asc';
    return;
  }
  if (value === 'desc') {
    queryState.sortBy = 'price';
    queryState.sortDir = 'desc';
    return;
  }

  const [sortBy, sortDir] = String(value || 'updatedAt_desc').split('_');
  queryState.sortBy = sortBy || 'updatedAt';
  queryState.sortDir = sortDir || 'desc';
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

async function fetchServices() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    const params = new URLSearchParams();
    if (queryState.q) params.set('q', queryState.q);
    if (queryState.category) params.set('category', queryState.category);
    if (queryState.status) params.set('status', queryState.status);
    params.set('sortBy', queryState.sortBy);
    params.set('sortDir', queryState.sortDir);
    params.set('pageNumber', String(queryState.pageNumber));
    params.set('pageSize', String(queryState.pageSize));

    const response = await fetch(SERVICES_API_URL + '?' + params.toString(), {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error('Không thể tải danh sách dịch vụ.');
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);

    servicesData = items.map(normalizeService);
    pagingState.totalCount = Number(data.totalCount || servicesData.length || 0);
    pagingState.totalPages = Math.max(1, Number(data.totalPages || 1));
    pagingState.hasNextPage = Boolean(data.hasNextPage);
    pagingState.hasPreviousPage = Boolean(data.hasPreviousPage);
  } catch (error) {
    servicesData = [];
    pagingState.totalCount = 0;
    pagingState.totalPages = 1;
    pagingState.hasNextPage = false;
    pagingState.hasPreviousPage = false;
    showToast(error.message || 'Lỗi tải dịch vụ.', 'error');
    console.error('Failed to fetch services:', error);
  }
}

async function loadAndRenderServices() {
  await fetchServices();

  if (queryState.pageNumber > pagingState.totalPages) {
    queryState.pageNumber = pagingState.totalPages;
    await fetchServices();
  }

  renderServices();
}

function updateStats() {
  const total = pagingState.totalCount;
  const active = servicesData.filter(function (s) {
    return s.status === 'Hoạt động';
  }).length;
  const inactive = servicesData.filter(function (s) {
    return s.status === 'Tạm ngưng';
  }).length;

  const totalEl = document.getElementById('stat-total');
  const activeEl = document.getElementById('stat-active');
  const inactiveEl = document.getElementById('stat-inactive');

  if (totalEl) totalEl.innerText = String(total);
  if (activeEl) activeEl.innerText = String(active);
  if (inactiveEl) inactiveEl.innerText = String(inactive);
}

function renderServices() {
  const tbody = document.getElementById('serviceTableBody');
  const totalServicesEl = document.getElementById('totalServices');
  if (!tbody) return;
  const canManage = canManageServices();

  if (totalServicesEl) totalServicesEl.innerText = String(pagingState.totalCount);

  tbody.innerHTML = servicesData.map(function (service) {
    const statusStyle = getStatusStyle(service.status);
    const priceFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(service.price);

    return '\
      <tr>\
        <td style="padding-left: 24px;">\
          <div style="display:flex; align-items:center; gap:12px;">\
            <div>\
               <p style="font-weight:600; font-size: 14px;">' + service.name + '</p>\
               <p style="font-size: 12px; color: var(--notion-gray-500);">' + (service.category || 'Khác') + '</p>\
            </div>\
          </div>\
        </td>\
        <td>\
          <p style="font-size:13px; color: var(--notion-gray-500); max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + service.description + '</p>\
        </td>\
        <td>\
          <span style="font-weight: 600; font-size: 14px;">' + priceFormatted + '</span>\
        </td>\
        <td><span class="notion-pill" style="background:' + statusStyle.bg + '; color:' + statusStyle.color + ';">' + service.status + '</span></td>\
        ' + (canManage ? '<td style="text-align:right; padding-right: 24px;">\
          <div style="display: flex; justify-content: flex-end; gap: 8px;">\
            <button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center;" onclick="openServiceModal(' + service.id + ')">\
              <span class="material-symbols-outlined" style="font-size:18px;">edit</span>\
            </button>\
            <button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center; color: #ef4444;" onclick="confirmDeleteService(' + service.id + ')">\
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>\
            </button>\
          </div>\
        </td>' : '') + '\
      </tr>';
  }).join('');

  const pageInfoEl = document.getElementById('servicePageInfo');
  if (pageInfoEl) {
    pageInfoEl.innerText = 'Trang ' + queryState.pageNumber + '/' + pagingState.totalPages;
  }

  const prevBtn = document.getElementById('btnPrevServices');
  if (prevBtn) prevBtn.disabled = !pagingState.hasPreviousPage;

  const nextBtn = document.getElementById('btnNextServices');
  if (nextBtn) nextBtn.disabled = !pagingState.hasNextPage;

  updateStats();
  applyServiceRoleAccess();
}

function openServiceModal(id) {
  if (!canManageServices()) return;

  const modal = document.getElementById('serviceModal');
  const title = document.getElementById('serviceModalTitle');
  const form = document.getElementById('serviceForm');

  if (id) {
    currentEditId = id;
    title.innerText = 'Chỉnh sửa dịch vụ';
    const service = servicesData.find(function (s) {
      return s.id === id;
    });
    if (service) {
      document.getElementById('svcName').value = service.name;
      document.getElementById('svcDesc').value = service.description;
      document.getElementById('svcPrice').value = service.price;
      document.getElementById('svcStatus').value = service.status;
      document.getElementById('svcCategory').value = service.category || 'Tiện ích & Khác';
    }
  } else {
    currentEditId = null;
    title.innerText = 'Thêm dịch vụ mới';
    form.reset();
  }

  modal.style.display = 'flex';
}

function closeServiceModal() {
  document.getElementById('serviceModal').style.display = 'none';
}

async function saveService(e) {
  e.preventDefault();
  if (!canManageServices()) {
    showToast('Bạn không có quyền tạo hoặc sửa dịch vụ.', 'error');
    return;
  }

  const name = document.getElementById('svcName').value;
  const description = document.getElementById('svcDesc').value;
  const price = parseFloat(document.getElementById('svcPrice').value);
  const status = document.getElementById('svcStatus').value;
  const category = document.getElementById('svcCategory').value || 'Tiện ích & Khác';

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    const payload = {
      id: currentEditId || 0,
      serviceName: name,
      category: category,
      description: description,
      price: price,
      status: status
    };

    let url = SERVICES_API_URL;
    let method = 'POST';

    if (currentEditId) {
      url += '/' + currentEditId;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method: method,
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Lưu dịch vụ thất bại.'));
    }

    showToast(currentEditId ? 'Cập nhật dịch vụ thành công!' : 'Thêm dịch vụ thành công!');
    closeServiceModal();
    await loadAndRenderServices();
  } catch (error) {
    showToast(error.message || 'Không thể lưu dịch vụ.', 'error');
    console.error('Failed to save service:', error);
  }
}

function confirmDeleteService(id) {
  if (!canManageServices()) {
    showToast('Bạn không có quyền xóa dịch vụ.', 'error');
    return;
  }

  serviceToDelete = id;
  document.getElementById('deleteConfirmModal').style.display = 'flex';
}

function closeDeleteModal() {
  serviceToDelete = null;
  document.getElementById('deleteConfirmModal').style.display = 'none';
}

async function deleteService() {
  if (!canManageServices()) {
    showToast('Bạn không có quyền xóa dịch vụ.', 'error');
    return;
  }

  if (!serviceToDelete) return;

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    const response = await fetch(SERVICES_API_URL + '/' + serviceToDelete, {
      method: 'DELETE',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Xóa dịch vụ thất bại.'));
    }

    closeDeleteModal();
    await loadAndRenderServices();
    showToast('Xóa dịch vụ thành công!');
  } catch (error) {
    showToast(error.message || 'Không thể xóa dịch vụ.', 'error');
    console.error('Failed to delete service:', error);
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  applyServiceRoleAccess();
  await loadLookups();

  const searchEl = document.getElementById('searchServiceInput');
  const categoryEl = document.getElementById('filterCategory');
  const statusEl = document.getElementById('filterServiceStatus');
  const sortEl = document.getElementById('sortPrice');

  if (searchEl) {
    const onSearch = window.AppCore && typeof window.AppCore.debounce === 'function'
      ? window.AppCore.debounce(async function () {
          queryState.q = searchEl.value.trim();
          queryState.pageNumber = 1;
          await loadAndRenderServices();
        }, 300)
      : async function () {
          queryState.q = searchEl.value.trim();
          queryState.pageNumber = 1;
          await loadAndRenderServices();
        };

    searchEl.addEventListener('input', onSearch);
  }

  if (categoryEl) {
    categoryEl.addEventListener('change', async function () {
      queryState.category = categoryEl.value;
      queryState.pageNumber = 1;
      await loadAndRenderServices();
    });
  }

  if (statusEl) {
    statusEl.addEventListener('change', async function () {
      queryState.status = statusEl.value;
      queryState.pageNumber = 1;
      await loadAndRenderServices();
    });
  }

  if (sortEl) {
    sortEl.addEventListener('change', async function () {
      parseSortValue(sortEl.value);
      queryState.pageNumber = 1;
      await loadAndRenderServices();
    });
  }

  const prevBtn = document.getElementById('btnPrevServices');
  if (prevBtn) {
    prevBtn.addEventListener('click', async function () {
      if (!pagingState.hasPreviousPage) return;
      queryState.pageNumber -= 1;
      await loadAndRenderServices();
    });
  }

  const nextBtn = document.getElementById('btnNextServices');
  if (nextBtn) {
    nextBtn.addEventListener('click', async function () {
      if (!pagingState.hasNextPage) return;
      queryState.pageNumber += 1;
      await loadAndRenderServices();
    });
  }

  const addBtn = document.getElementById('btnAddService');
  if (addBtn) addBtn.addEventListener('click', function () { openServiceModal(); });

  const serviceForm = document.getElementById('serviceForm');
  if (serviceForm) serviceForm.addEventListener('submit', saveService);

  await loadAndRenderServices();
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
    _populateSelect('filterCategory', data.serviceCategories, 'Tất cả danh mục', '');
    _populateSelect('filterServiceStatus', data.serviceStatuses, 'Tất cả trạng thái', '');
    _populateSelect('svcCategory', data.serviceCategories);
    _populateSelect('svcStatus', data.serviceStatuses);
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
