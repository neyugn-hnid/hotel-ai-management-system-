const API_BASE_URL = 'https://localhost:7082/api';
const ROOMS_API_URL = API_BASE_URL + '/Rooms';
const CUSTOMERS_API_URL = API_BASE_URL + '/Customers';
const BOOKINGS_API_URL = API_BASE_URL + '/Bookings';
const DEFAULT_PRICE = 12500000;

let currentRoom = null;
let images = [];
let currentIdx = 0;

function showToast(message, variant) {
  if (window.AppCore && typeof window.AppCore.toast === 'function') {
    window.AppCore.toast(message, variant);
    return;
  }
  console.warn(message);
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function sanitizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').trim();
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

async function fetchRoom(roomId) {
  if (!roomId) {
    throw new Error('Không tìm thấy ID phòng trong URL.');
  }

  const response = await fetch(ROOMS_API_URL + '/' + encodeURIComponent(roomId), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải thông tin phòng.'));
  }

  return await response.json();
}

function normalizeRoom(raw) {
  const imageList = Array.isArray(raw.images) ? raw.images : [];
  const imageUrls = imageList
    .map(function (img) {
      return img.imageUrl || img.url;
    })
    .filter(function (url) {
      return url && typeof url === 'string';
    });

  
  if (imageUrls.length === 0) {
    const fallbackImages = [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80',
      'https://images.unsplash.com/photo-1598301257097-dfd1e3a0eaae?w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
      'https://images.unsplash.com/photo-1566665556112-652201b900ef?w=1200&q=80',
      'https://images.unsplash.com/photo-1582719534544-ddfbbf4f58e9?w=1200&q=80'
    ];
    return fallbackImages;
  }

  return imageUrls;
}

function renderRoomData(room) {
  currentRoom = room;
  images = normalizeRoom(room);

  document.getElementById('roomNameSpan').textContent = room.cardName || room.name || 'Phòng';
  document.getElementById('roomTypeBadge').textContent = room.roomType || 'Standard';
  document.getElementById('roomDescription').textContent = room.description || 'Không có mô tả.';
  document.getElementById('roomPricePerNight').textContent = (room.pricePerNight || DEFAULT_PRICE).toLocaleString('vi-VN') + '₫';
  document.getElementById('cRoomName').textContent = room.cardName || room.name || 'Phòng';

  if (images.length > 0) {
    document.getElementById('mainImage').src = images[0];
  }

  const galleryThumbs = document.getElementById('galleryThumbs');
  galleryThumbs.innerHTML = '';

  images.forEach(function (img, i) {
    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb' + (i === 0 ? ' active' : '');
    thumb.onclick = function () {
      changeImage(i);
    };

    const thumbImg = document.createElement('img');
    thumbImg.src = img.replace('w=1200', 'w=400');
    thumbImg.alt = 'Thumb ' + (i + 1);

    thumb.appendChild(thumbImg);
    galleryThumbs.appendChild(thumb);
  });

  currentIdx = 0;
  updateSummary();
}

function updateGallery(index) {
  if (images.length === 0) return;

  const mainImg = document.getElementById('mainImage');
  mainImg.style.opacity = 0;

  setTimeout(function () {
    mainImg.src = images[index];
    mainImg.style.opacity = 1;
  }, 150);

  document.querySelectorAll('.gallery-thumb').forEach(function (thumb, i) {
    if (i === index) {
      thumb.classList.add('active');
    } else {
      thumb.classList.remove('active');
    }
  });
}

function changeImage(i) {
  currentIdx = i;
  updateGallery(i);
}

function nextImage() {
  currentIdx = (currentIdx + 1) % (images.length || 1);
  updateGallery(currentIdx);
}

function prevImage() {
  currentIdx = (currentIdx - 1 + (images.length || 1)) % (images.length || 1);
  updateGallery(currentIdx);
}

function updateSummary() {
  const checkInInput = document.getElementById('bookCheckIn');
  const checkOutInput = document.getElementById('bookCheckOut');

  const d1 = new Date(checkInInput.value);
  const d2 = new Date(checkOutInput.value);
  const diffTime = d2 - d1;
  const diffDays = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 1;
  const roomPrice = (currentRoom && currentRoom.pricePerNight) || DEFAULT_PRICE;
  const total = diffDays * roomPrice;

  document.getElementById('summaryPriceLabel').innerHTML = (roomPrice || DEFAULT_PRICE).toLocaleString('vi-VN') + '₫ x <span id="summaryDays">' + diffDays + '</span> đêm';
  document.getElementById('summaryPrice').innerText = total.toLocaleString('vi-VN');
  document.getElementById('summaryTotal').innerText = total.toLocaleString('vi-VN');
}

async function createCustomer(name, phone) {
  const customerData = {
    fullName: String(name || '').trim(),
    email: null,
    phoneNumber: sanitizePhone(phone),
    identityCard: null,
    status: 'Khách mới',
    aiPreferences: ''
  };

  const response = await fetch(CUSTOMERS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerData)
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tạo thông tin khách hàng'));
  }

  return await response.json();
}

async function findCustomerByPhone(phone) {
  const normalizedPhone = sanitizePhone(phone).replace(/[^\d]/g, '');
  if (!normalizedPhone) {
    return null;
  }

  const params = new URLSearchParams({
    phone: normalizedPhone
  });

  const response = await fetch(CUSTOMERS_API_URL + '/public/by-phone?' + params.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể kiểm tra khách hàng theo số điện thoại'));
  }

  return await response.json();
}

async function findOrCreateCustomer(name, phone) {
  const existingCustomer = await findCustomerByPhone(phone);
  if (existingCustomer && existingCustomer.id) {
    return existingCustomer;
  }

  return await createCustomer(name, phone);
}

window.onload = async function () {
  const roomId = getQueryParam('id');

  try {
    const raw = await fetchRoom(roomId);
    renderRoomData(raw);
  } catch (error) {
    showToast(error.message || 'Không thể tải thông tin phòng.', 'error');
    document.getElementById('roomNameSpan').textContent = 'Không tìm thấy phòng';
  }

  const checkInInput = document.getElementById('bookCheckIn');
  const checkOutInput = document.getElementById('bookCheckOut');

  const today = new Date().toISOString().split('T')[0];
  checkInInput.value = getQueryParam('checkIn') || today;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  checkOutInput.value = getQueryParam('checkOut') || tomorrow.toISOString().split('T')[0];

  checkInInput.addEventListener('change', updateSummary);
  checkOutInput.addEventListener('change', updateSummary);

  document.getElementById('bookingForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const checkIn = checkInInput.value;
    const checkOut = checkOutInput.value;
    const name = document.getElementById('bookName').value;
    const phone = document.getElementById('bookPhone').value;

    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    if (!checkIn || !checkOut || d2 <= d1) {
      showToast('Ngày trả phòng phải sau ngày nhận phòng.', 'error');
      return;
    }

    const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    const roomPrice = (currentRoom && currentRoom.pricePerNight) || DEFAULT_PRICE;
    const total = diffDays * roomPrice;

    document.getElementById('cName').innerText = name;
    document.getElementById('cPhone').innerText = phone;
    document.getElementById('cIn').innerText = checkIn;
    document.getElementById('cOut').innerText = checkOut;
    document.getElementById('cTotal').innerText = total.toLocaleString('vi-VN') + ' ₫';

    try {
      const customer = await findOrCreateCustomer(name, phone);
      const customerId = customer.id;
      const bookingData = {
        bookingCode: 'BKG-WEB' + Date.now(),
        customerId: customerId,
        roomId: currentRoom.id || currentRoom.Id,
        accountId: null,
        checkInDate: checkIn + 'T00:00:00',
        checkOutDate: checkOut + 'T00:00:00',
        status: 'Chờ xác nhận',
        totalRoomAmount: total,
        notes: 'Yêu cầu đặt qua website - SĐT: ' + sanitizePhone(phone)
      };

      const bookingResponse = await fetch(BOOKINGS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });

      if (!bookingResponse.ok) {
        throw new Error(await extractApiError(bookingResponse, 'Không thể tạo đặt phòng'));
      }

      const booking = await bookingResponse.json();
      showToast('Đã gửi yêu cầu đặt phòng. Mã phiếu: ' + bookingData.bookingCode, 'success');
      document.getElementById('cRoomName').innerText = (currentRoom && (currentRoom.cardName || currentRoom.name)) || 'Phòng';
      document.getElementById('bookingConfirmModal').style.display = 'flex';
      document.getElementById('bookingForm').reset();
      checkInInput.value = getQueryParam('checkIn') || today;
      checkOutInput.value = getQueryParam('checkOut') || tomorrow.toISOString().split('T')[0];
      updateSummary();
    } catch (error) {
      showToast(error.message || 'Lỗi khi đặt phòng. Vui lòng thử lại.', 'error');
    }
  });
};
