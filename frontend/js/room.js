let roomsData = [];
let currentEditId = null;
let roomToDelete = null;
let selectedImages = [];

const ROOMS_API_URL = 'https://localhost:7082/api/Rooms';
const DEFAULT_ROOM_IMAGE = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80';

const queryState = {
  q: '',
  roomType: '',
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

function canManageRooms() {
  return Boolean(window.AppCore && typeof window.AppCore.isAdminRole === 'function'
    && window.AppCore.isAdminRole(window.AppCore.getAuthContext().role));
}

function applyRoomRoleAccess() {
  const canManage = canManageRooms();
  const addBtn = document.getElementById('btnAddRoom');
  const actionsHeader = document.getElementById('roomActionsHeader');
  const submitBtn = document.getElementById('roomSubmitButton');
  const deleteBtn = document.getElementById('roomDeleteButton');

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

function mapStatusFromBackend(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'trống' || normalized === 'phòng trống') return 'Phòng trống';
  if (normalized === 'đang sử dụng') return 'Đang sử dụng';
  if (normalized === 'đã đặt') return 'Đã đặt';
  if (normalized === 'bảo trì') return 'Bảo trì';
  if (normalized === 'đang dọn dẹp') return 'Đang dọn dẹp';
  return 'Phòng trống';
}

function mapStatusToBackend(status) {
  if (status === 'Phòng trống') return 'Trống';
  return status;
}

function normalizeRoom(raw) {
  const images = Array.isArray(raw.images) ? raw.images : [];
  const imageUrls = images
    .map(function (img) {
      return img && img.imageUrl ? img.imageUrl : '';
    })
    .filter(Boolean);

  return {
    id: Number(raw.id),
    name: raw.cardName || raw.name || 'Phòng chưa đặt tên',
    description: raw.description || '',
    type: raw.roomType || 'Standard',
    price: Number(raw.pricePerNight || 0),
    status: mapStatusFromBackend(raw.status),
    imgs: imageUrls.length > 0 ? imageUrls : [DEFAULT_ROOM_IMAGE]
  };
}

function getStatusStyle(status) {
  switch (status) {
    case 'Phòng trống': return { bg: '#e7f3ef', color: '#0d7350' };
    case 'Đang sử dụng': return { bg: '#f2f9ff', color: '#097fe8' };
    case 'Đã đặt': return { bg: '#fff2e0', color: '#d97706' };
    case 'Bảo trì': return { bg: '#fee2e2', color: '#ef4444' };
    case 'Đang dọn dẹp': return { bg: '#f6f5f4', color: '#615d59' };
    default: return { bg: '#f1f5f9', color: '#615d59' };
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

async function fetchRooms() {
  try {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    const params = new URLSearchParams();
    if (queryState.q) params.set('q', queryState.q);
    if (queryState.roomType) params.set('roomType', queryState.roomType);
    if (queryState.status) params.set('status', mapStatusToBackend(queryState.status));
    params.set('sortBy', queryState.sortBy);
    params.set('sortDir', queryState.sortDir);
    params.set('pageNumber', String(queryState.pageNumber));
    params.set('pageSize', String(queryState.pageSize));

    const response = await fetch(ROOMS_API_URL + '?' + params.toString(), {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error('Không thể tải danh sách phòng từ máy chủ.');
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);

    roomsData = items.map(normalizeRoom);
    pagingState.totalCount = Number(data.totalCount || roomsData.length || 0);
    pagingState.totalPages = Math.max(1, Number(data.totalPages || 1));
    pagingState.hasNextPage = Boolean(data.hasNextPage);
    pagingState.hasPreviousPage = Boolean(data.hasPreviousPage);
  } catch (error) {
    roomsData = [];
    pagingState.totalCount = 0;
    pagingState.totalPages = 1;
    pagingState.hasNextPage = false;
    pagingState.hasPreviousPage = false;
    showToast(error.message || 'Lỗi tải dữ liệu phòng.', 'error');

  }
}

function renderRooms() {
  const tbody = document.getElementById('roomTableBody');
  if (!tbody) return;
  const canManage = canManageRooms();
  
  tbody.innerHTML = roomsData.map(room => {
    const statusStyle = getStatusStyle(room.status);
    const mainImg = room.imgs && room.imgs.length > 0 ? room.imgs[0] : "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80";
    const imgCount = room.imgs ? room.imgs.length : 0;
    const actionsCell = canManage ? `
        <td style="text-align: right; padding-right: 24px;">
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center;" onclick="openRoomModal(${room.id})">
              <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
            </button>
            <button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center; color: #ef4444;" onclick="confirmDeleteRoom(${room.id})">
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>
          </div>
        </td>
    ` : '';
    
    return `
      <tr>
        <td style="padding-left: 24px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:4px; overflow:hidden; flex-shrink:0; border: var(--notion-whisper); position: relative;">
              <img src="${mainImg}" alt="Room" style="width:100%;height:100%;object-fit:cover;"/>
              ${imgCount > 1 ? `<span style="position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 8px; padding: 1px 3px; border-top-left-radius: 3px;">+${imgCount-1}</span>` : ''}
            </div>
            <div>
              <div style="font-weight:600; font-size: 14px;">${room.name}</div>
              <div style="font-size:12px; color: var(--notion-gray-500);">${room.description || 'Không có mô tả'}</div>
            </div>
          </div>
        </td>
        <td><span style="font-size:14px; font-weight:500;">${room.type}</span></td>
        <td><span style="font-size:14px; font-weight:600;">${formatCurrency(room.price)}</span></td>
        <td>
          <span class="notion-pill" style="background:${statusStyle.bg}; color:${statusStyle.color};">
            ${room.status}
          </span>
        </td>
        ${actionsCell}
      </tr>
    `;
  }).join('');
  
  applyRoomRoleAccess();
  updateStats();
}

function updateStats() {
  const total = pagingState.totalCount;
    const inUse = roomsData.filter(r => r.status === 'Đang sử dụng').length;
    const available = roomsData.filter(r => r.status === 'Phòng trống').length;
    
    const totalEl = document.getElementById('stat-total');
    const inUseEl = document.getElementById('stat-inuse');
    const availableEl = document.getElementById('stat-available');
    const totalRoomsEl = document.getElementById('totalRooms');

    if(totalEl) totalEl.innerText = total;
    if(inUseEl) inUseEl.innerText = inUse;
    if(availableEl) availableEl.innerText = available;
    if(totalRoomsEl) totalRoomsEl.innerText = total;

    const pageInfoEl = document.getElementById('roomPageInfo');
    if (pageInfoEl) {
      pageInfoEl.innerText = 'Trang ' + queryState.pageNumber + '/' + pagingState.totalPages;
    }

    const prevBtn = document.getElementById('btnPrevRooms');
    if (prevBtn) prevBtn.disabled = !pagingState.hasPreviousPage;

    const nextBtn = document.getElementById('btnNextRooms');
    if (nextBtn) nextBtn.disabled = !pagingState.hasNextPage;
}


function handleSearch() {
    queryState.q = document.getElementById('searchInput').value.trim();
    queryState.pageNumber = 1;
    applyAllFilters();
}

function handleFilter() {
    const typeFilter = document.getElementById('filterType').value;
    const statusFilter = document.getElementById('filterStatus').value;
    queryState.roomType = typeFilter === 'All' ? '' : typeFilter;
    queryState.status = statusFilter;
    queryState.pageNumber = 1;
    applyAllFilters();
}

function handleSort() {
    const sortValue = document.getElementById('sortBy').value;
    if (sortValue === 'priceAsc') {
      queryState.sortBy = 'price';
      queryState.sortDir = 'asc';
    } else if (sortValue === 'priceDesc') {
      queryState.sortBy = 'price';
      queryState.sortDir = 'desc';
    } else if (sortValue === 'name') {
      queryState.sortBy = 'name';
      queryState.sortDir = 'asc';
    } else if (sortValue === 'updatedAtAsc') {
      queryState.sortBy = 'updatedAt';
      queryState.sortDir = 'asc';
    } else {
      queryState.sortBy = 'updatedAt';
      queryState.sortDir = 'desc';
    }
    queryState.pageNumber = 1;
    applyAllFilters();
}

async function applyAllFilters() {
    await fetchRooms();
    if (queryState.pageNumber > pagingState.totalPages) {
      queryState.pageNumber = pagingState.totalPages;
      await fetchRooms();
    }
    renderRooms();
}


function previewImages() {
    const fileInput = document.getElementById('roomImages');
    const previewContainer = document.getElementById('imagePreviewContainer');
    previewContainer.innerHTML = '';
    selectedImages = [];

    if (fileInput.files.length === 0) {
        previewContainer.innerHTML = '<p style="font-size: 11px; color: var(--notion-gray-500); width: 100%; text-align: center;">Chưa có ảnh nào được chọn</p>';
        return;
    }

    Array.from(fileInput.files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImages.push(e.target.result);
            const imgWrapper = document.createElement('div');
            imgWrapper.style = "width: 60px; height: 60px; border-radius: 4px; overflow: hidden; border: 1px solid var(--notion-gray-300); position: relative;";
            imgWrapper.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;"/>`;
            previewContainer.appendChild(imgWrapper);
        };
        reader.readAsDataURL(file);
    });
}

function openRoomModal(id = null) {
  if (!canManageRooms()) {
    return;
  }

  const modal = document.getElementById('roomModal');
  const title = document.getElementById('roomModalTitle');
  const form = document.getElementById('roomForm');
  const previewContainer = document.getElementById('imagePreviewContainer');
  
  if (id) {
    currentEditId = id;
    title.innerText = 'Chỉnh sửa phòng';
    const room = roomsData.find(r => r.id === id);
    if (room) {
      document.getElementById('roomName').value = room.name;
      document.getElementById('roomDescription').value = room.description || '';
      document.getElementById('roomPrice').value = room.price;
      document.getElementById('roomType').value = room.type;
      document.getElementById('roomStatus').value = room.status;
      
      
      selectedImages = [...(room.imgs || [])];
      previewContainer.innerHTML = selectedImages.map(img => `
        <div style="width: 60px; height: 60px; border-radius: 4px; overflow: hidden; border: 1px solid var(--notion-gray-300);">
            <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;"/>
        </div>
      `).join('');
      if (selectedImages.length === 0) {
          previewContainer.innerHTML = '<p style="font-size: 11px; color: var(--notion-gray-500); width: 100%; text-align: center;">Chưa có ảnh nào được lưu</p>';
      }
    }
  } else {
    currentEditId = null;
    title.innerText = 'Thêm phòng mới';
    form.reset();
    selectedImages = [];
    previewContainer.innerHTML = '<p style="font-size: 11px; color: var(--notion-gray-500); width: 100%; text-align: center;">Chưa có ảnh nào được chọn</p>';
  }
  
  modal.style.display = 'flex';
}

function closeRoomModal() {
  document.getElementById('roomModal').style.display = 'none';
}

async function saveRoom(e) {
  e.preventDefault();
  if (!canManageRooms()) {
    showToast('Bạn không có quyền tạo hoặc sửa phòng.', 'error');
    return;
  }

  const validation = window.AppCore && window.AppCore.Validation;
  if (validation && !validation.validateFields(e.target, [
    {
      input: '#roomName',
      validate: function(value) {
        return validation.normalizeText(value).length >= 2 ? '' : 'Tên phòng phải có ít nhất 2 ký tự.';
      }
    },
    {
      input: '#roomDescription',
      validate: function(value) {
        return validation.normalizeText(value).length >= 10 ? '' : 'Mô tả phòng phải có ít nhất 10 ký tự.';
      }
    },
    {
      input: '#roomPrice',
      validate: function(value) {
        return validation.isPositiveNumber(value) ? '' : 'Giá phòng phải lớn hơn 0.';
      }
    },
    {
      input: '#roomType',
      validate: function(value) {
        return validation.normalizeText(value) ? '' : 'Vui lòng chọn loại phòng.';
      }
    },
    {
      input: '#roomStatus',
      validate: function(value) {
        return validation.normalizeText(value) ? '' : 'Vui lòng chọn trạng thái phòng.';
      }
    }
  ])) {
    return;
  }

  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDescription').value.trim();
  const price = parseFloat(document.getElementById('roomPrice').value);
  const type = document.getElementById('roomType').value;
  const status = document.getElementById('roomStatus').value;

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    if (currentEditId) {
      const payload = {
        id: currentEditId,
        cardName: name,
        roomType: type,
        pricePerNight: price,
        status: mapStatusToBackend(status),
        description: description,
        images: selectedImages
      };

      const response = await fetch(ROOMS_API_URL + '/' + currentEditId, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Cập nhật phòng thất bại.');
      }

      showToast('Cập nhật phòng thành công!');
    } else {
      const payload = {
        name: name,
        roomType: type,
        pricePerNight: price,
        status: mapStatusToBackend(status),
        description: description,
        images: selectedImages
      };

      const response = await fetch(ROOMS_API_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Tạo phòng thất bại.');
      }

      showToast('Tạo phòng thành công!');
    }

    closeRoomModal();
    await applyAllFilters();
  } catch (error) {
    showToast(error.message || 'Lưu phòng thất bại.', 'error');

  }
}

function confirmDeleteRoom(id) {
  if (!canManageRooms()) {
    showToast('Bạn không có quyền xóa phòng.', 'error');
    return;
  }

  roomToDelete = id;
  document.getElementById('deleteConfirmModal').style.display = 'flex';
}

function closeDeleteModal() {
  roomToDelete = null;
  document.getElementById('deleteConfirmModal').style.display = 'none';
}

async function deleteRoom() {
  if (!canManageRooms()) {
    showToast('Bạn không có quyền xóa phòng.', 'error');
    return;
  }

  if (roomToDelete) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    try {
      const response = await fetch(ROOMS_API_URL + '/' + roomToDelete, {
        method: 'DELETE',
        headers: headers
      });

      if (!response.ok) {
        throw new Error('Xóa phòng thất bại.');
      }

      closeDeleteModal();
      await applyAllFilters();
      showToast('Xóa phòng thành công!');
    } catch (error) {
      showToast(error.message || 'Không thể xóa phòng.', 'error');

    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  applyRoomRoleAccess();
  await loadLookups();

  const searchInput = document.getElementById('searchInput');
  if (searchInput && window.AppCore && typeof window.AppCore.debounce === 'function') {
    searchInput.onkeyup = window.AppCore.debounce(handleSearch, 300);
  }

  await applyAllFilters();
  
  const addBtn = document.getElementById('btnAddRoom');
  if(addBtn) addBtn.addEventListener('click', () => openRoomModal());
  
  const roomForm = document.getElementById('roomForm');
  if(roomForm) roomForm.addEventListener('submit', saveRoom);

  const prevBtn = document.getElementById('btnPrevRooms');
  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      if (!pagingState.hasPreviousPage) return;
      queryState.pageNumber -= 1;
      await applyAllFilters();
    });
  }

  const nextBtn = document.getElementById('btnNextRooms');
  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      if (!pagingState.hasNextPage) return;
      queryState.pageNumber += 1;
      await applyAllFilters();
    });
  }
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
    _populateSelect('filterType', data.roomTypes, 'Tất cả loại', 'All');
    _populateSelect('filterStatus', data.roomStatuses, 'Tất cả trạng thái', '');
    _populateSelect('roomType', data.roomTypes);
    _populateSelect('roomStatus', data.roomStatuses);
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
    opt.value = item;
    opt.textContent = item;
    el.appendChild(opt);
  });
}
