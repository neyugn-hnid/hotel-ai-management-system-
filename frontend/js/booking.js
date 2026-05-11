const API_BASE_URL = 'https://localhost:7082';
const BOOKING_API_URL = API_BASE_URL + '/api/Bookings';
const BOOKING_AI_API_URL = API_BASE_URL + '/api/Bookings/ai/recommend';
const CUSTOMERS_API_URL = API_BASE_URL + '/api/Customers';
const ROOMS_API_URL = API_BASE_URL + '/api/Rooms';
const INVOICES_API_URL = API_BASE_URL + '/api/Invoices';
const SERVICES_API_URL = API_BASE_URL + '/api/Services';
const BOOKING_HUB_URL = API_BASE_URL + '/bookingHub';

let pendingBookings = [];
let confirmedBookings = [];
let localConfirmedBookings = [];
let customerDirectory = [];
let roomDirectory = [];
let aiBookingInventory = [];
let invoiceServicesCatalog = [];
let activeInvoiceBookingCode = null;
let invoiceBaseAmount = 0;
let invoicedBookingIds = new Set();
let bookingRealtimeConnection = null;
let bookingRealtimeRefreshTimer = null;

const pendingQueryState = {
  q: '',
  status: 'Chờ xác nhận',
  sortBy: 'createdAt',
  sortDir: 'desc',
  pageNumber: 1,
  pageSize: 10
};

const confirmedQueryState = {
  q: '',
  status: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  pageNumber: 1,
  pageSize: 10
};

const pendingPagingState = {
  totalCount: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
};

const confirmedPagingState = {
  totalCount: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
};

const customerProfiles = {
  'Seraphina Vance': { cccd: '001122334455', phone: '0901234567', stayCount: 42, tier: 'VIP', preferences: ['Tầng 35 trở lên', 'View công viên', 'Nến Sandalwood'], suggestion: 'Khách thường đặt Penthouse vào tháng 5. Hãy đề xuất nâng cấp dịch vụ quà tặng "Jubilee".' },
  'Alexander Hamilton': { cccd: '001122334466', phone: '0912233445', stayCount: 15, tier: 'Platinum', preferences: ['Gần thang máy', 'Yên tĩnh', 'Ăn sáng tại phòng'], suggestion: 'Khách có xu hướng check-out trễ. Có thể chuẩn bị sẵn gói Late Check-out miễn phí.' },
  'Julian Blackwood': { cccd: '001122334477', phone: '0988776655', stayCount: 8, tier: 'Gold', preferences: ['View thành phố', 'Mini bar đa dạng'], suggestion: 'Khách quan tâm đến các dịch vụ Spa. Hãy gửi kèm voucher giảm giá 20%.' },
  'Lê Minh Hoàng': { cccd: '001122334488', phone: '0977112233', stayCount: 5, tier: 'Silver', preferences: ['View biển', 'Ban công rộng'], suggestion: 'Khách thích hải sản cao cấp. Hãy giới thiệu nhà hàng Marina ở tầng G.' },
  'Nguyễn Thu Hà': { cccd: '001122334499', phone: '0966445566', stayCount: 2, tier: 'Member', preferences: ['Không hút thuốc'], suggestion: 'Khách mới.' }
};

const aiRoomOptions = [
  {
    id: 'opt-1',
    name: 'Royal Penthouse Suite',
    price: '61.250.000',
    match: '98%',
    img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
    floor: '42',
    view: 'Panorama View',
    service: 'Quản gia riêng',
    reason: '"Vị trí Penthouse này đáp ứng hoàn hảo thói quen ưu tiên tầng cao và không gian tĩnh lặng của khách Vance, mang lại cảm giác biệt lập thượng lưu."'
  },
  {
    id: 'opt-2',
    name: 'Imperial Presidential Suite',
    price: '77.500.000',
    match: '95%',
    img: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
    floor: '45',
    view: 'Ocean & City View',
    service: 'Lounge riêng biệt',
    reason: '"Không gian rộng lớn nhất khách sạn, phù hợp cho nhu cầu tiếp khách và làm việc cường độ cao của khách Hamilton."'
  }
];

const aiFallbackImages = [
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80'
];

function showToast(message, variant) {
  if (window.AppCore && typeof window.AppCore.toast === 'function') {
    window.AppCore.toast(message, variant);
    return;
  }
  alert(message);
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(atob(normalized));
  } catch (_) {
    return null;
  }
}

function getCurrentAccountId() {
  const token = localStorage.getItem('token');
  const payload = decodeJwtPayload(token);
  const rawValue = payload && (payload.sub || payload.nameid || payload.accountId);
  const accountId = Number(rawValue || 0);
  return accountId > 0 ? accountId : null;
}

function parseSortValue(value, state) {
  const [sortBy, sortDir] = String(value || 'createdAt_desc').split('_');
  state.sortBy = sortBy || 'createdAt';
  state.sortDir = sortDir || 'desc';
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function scheduleRealtimeBookingRefresh() {
  if (bookingRealtimeRefreshTimer) {
    clearTimeout(bookingRealtimeRefreshTimer);
  }

  bookingRealtimeRefreshTimer = setTimeout(async function () {
    bookingRealtimeRefreshTimer = null;
    try {
      await Promise.all([
        loadAndRenderPendingBookings(),
        loadAndRenderConfirmedBookings(),
        fetchBookingInventory(),
        fetchInvoiceIndex()
      ]);
    } catch (error) {
      showToast(error.message || 'Không thể đồng bộ booking realtime.', 'error');
    }
  }, 250);
}

async function initBookingRealtime() {
  if (!window.signalR || bookingRealtimeConnection) {
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return;
  }

  bookingRealtimeConnection = new window.signalR.HubConnectionBuilder()
    .withUrl(BOOKING_HUB_URL, {
      accessTokenFactory: function () {
        return localStorage.getItem('token') || '';
      }
    })
    .withAutomaticReconnect()
    .build();

  bookingRealtimeConnection.on('bookingCreated', function (payload) {
    const bookingCode = payload && payload.bookingCode ? payload.bookingCode : 'booking mới';
    showToast('Có phiếu đặt phòng mới từ website: ' + bookingCode, 'success');
    scheduleRealtimeBookingRefresh();
  });

  bookingRealtimeConnection.on('bookingUpdated', function () {
    scheduleRealtimeBookingRefresh();
  });

  try {
    await bookingRealtimeConnection.start();
  } catch (error) {
    bookingRealtimeConnection = null;

  }
}

function normalizeBooking(raw) {
  return {
    id: Number(raw.id || 0),
    bookingCode: raw.bookingCode || ('BKG-' + String(raw.id || '0')),
    customerId: Number(raw.customerId || 0),
    accountId: Number(raw.accountId || 0),
    accountName: raw.accountName || '',
    roomId: Number(raw.roomId || 0),
    customerName: raw.customerName || 'Khách chưa rõ',
    customerEmail: raw.customerEmail || '--',
    roomName: raw.roomName || raw.roomType || 'Không xác định',
    status: raw.status || 'Chờ xác nhận',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    checkInDate: raw.checkInDate || raw.checkIn || raw.startDate || '',
    checkOutDate: raw.checkOutDate || raw.checkOut || raw.endDate || '',
    totalRoomAmount: Number(raw.totalRoomAmount || 0)
  };
}

function normalizeCustomer(raw) {
  return {
    id: Number(raw.id || 0),
    fullName: raw.fullName || 'Khách chưa rõ',
    email: raw.email || '',
    phoneNumber: raw.phoneNumber || '',
    identityCard: raw.identityCard || '',
    status: raw.status || '',
    aiPreferences: raw.aiPreferences || ''
  };
}

function normalizeRoom(raw) {
  return {
    id: Number(raw.id || 0),
    cardName: raw.cardName || raw.name || 'Phòng chưa đặt tên',
    roomType: raw.roomType || '',
    pricePerNight: Number(raw.pricePerNight || 0),
    status: raw.status || '',
    description: raw.description || ''
  };
}

function normalizeWorkflowStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isPendingWorkflowStatus(status) {
  const normalized = normalizeWorkflowStatus(status);
  return normalized === 'chờ xác nhận' || normalized === 'cho xac nhan';
}

function isConfirmedWorkflowStatus(status) {
  const normalized = normalizeWorkflowStatus(status);
  return normalized === 'đã xác nhận giữ chỗ'
    || normalized === 'da xac nhan giu cho'
    || normalized === 'đã check-in'
    || normalized === 'da check-in';
}

function getWorkflowStatusLabel(status) {
  const normalized = normalizeWorkflowStatus(status);
  if (normalized === 'chờ xác nhận' || normalized === 'cho xac nhan') {
    return 'Chờ xác nhận';
  }
  if (normalized === 'đã xác nhận giữ chỗ' || normalized === 'da xac nhan giu cho') {
    return 'Đã xác nhận giữ chỗ';
  }
  if (normalized === 'đã check-in' || normalized === 'da check-in') {
    return 'Đã check-in';
  }
  return status || '--';
}

function getWorkflowStatusPillStyle(status) {
  const normalized = normalizeWorkflowStatus(status);
  if (normalized === 'chờ xác nhận' || normalized === 'cho xac nhan') {
    return 'background: #fff2e0; color: #d97706;';
  }
  if (normalized === 'đã xác nhận giữ chỗ' || normalized === 'da xac nhan giu cho') {
    return 'background: #e0f2fe; color: #0369a1;';
  }
  if (normalized === 'đã check-in' || normalized === 'da check-in') {
    return 'background: #e7f3ef; color: #0d7350;';
  }
  return 'background: #f1f5f9; color: #475569;';
}

function normalizeService(raw) {
  return {
    id: Number(raw.id || 0),
    name: raw.serviceName || 'Dịch vụ',
    price: Number(raw.price || 0),
    status: raw.status || 'Hoạt động'
  };
}

function findCustomerByBooking(booking) {
  if (!booking) return null;

  if (booking.customerId) {
    const matchedById = customerDirectory.find(function (customer) {
      return Number(customer.id || 0) === Number(booking.customerId || 0);
    });
    if (matchedById) return matchedById;
  }

  const bookingName = String(booking.customerName || '').trim().toLowerCase();
  if (!bookingName) return null;

  return customerDirectory.find(function (customer) {
    return String(customer.fullName || '').trim().toLowerCase() === bookingName;
  }) || null;
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

async function fetchBookingList(state, pagingState) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.status) params.set('status', state.status);
  params.set('sortBy', state.sortBy);
  params.set('sortDir', state.sortDir);
  params.set('pageNumber', String(state.pageNumber));
  params.set('pageSize', String(state.pageSize));

  const response = await fetch(BOOKING_API_URL + '?' + params.toString(), {
    method: 'GET',
    headers: headers
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải danh sách booking.'));
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);

  pagingState.totalCount = Number(data.totalCount || items.length || 0);
  pagingState.totalPages = Math.max(1, Number(data.totalPages || 1));
  pagingState.hasNextPage = Boolean(data.hasNextPage);
  pagingState.hasPreviousPage = Boolean(data.hasPreviousPage);

  return items.map(normalizeBooking);
}

async function fetchBookingInventory() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const params = new URLSearchParams({
    sortBy: 'checkInDate',
    sortDir: 'asc',
    pageNumber: '1',
    pageSize: '200'
  });

  const response = await fetch(BOOKING_API_URL + '?' + params.toString(), {
    method: 'GET',
    headers: headers
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải tồn kho booking cho AI.'));
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
  aiBookingInventory = items.map(normalizeBooking);
}

async function fetchLookupData() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const customerParams = new URLSearchParams({
    sortBy: 'name',
    sortDir: 'asc',
    pageNumber: '1',
    pageSize: '100'
  });

  const roomParams = new URLSearchParams({
    sortBy: 'name',
    sortDir: 'asc',
    pageNumber: '1',
    pageSize: '100'
  });

  const [customerResponse, roomResponse, lookupsResponse] = await Promise.all([
    fetch(CUSTOMERS_API_URL + '?' + customerParams.toString(), {
      method: 'GET',
      headers: headers
    }),
    fetch(ROOMS_API_URL + '?' + roomParams.toString(), {
      method: 'GET',
      headers: headers
    }),
    fetch(API_BASE_URL + '/api/Lookups', {
      method: 'GET',
      headers: headers
    })
  ]);

  if (!customerResponse.ok) {
    throw new Error(await extractApiError(customerResponse, 'Không thể tải danh sách khách hàng.'));
  }
  if (!roomResponse.ok) {
    throw new Error(await extractApiError(roomResponse, 'Không thể tải danh sách phòng.'));
  }

  const customerData = await customerResponse.json();
  const roomData = await roomResponse.json();

  if (lookupsResponse.ok) {
    const lookupsData = await lookupsResponse.json();
    const statusEl = document.getElementById('bookingInvoiceStatus');
    if (statusEl && lookupsData.bookingStatuses) {
      statusEl.innerHTML = '';
      lookupsData.bookingStatuses.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        statusEl.appendChild(opt);
      });
    }
  }

  const customerItems = Array.isArray(customerData)
    ? customerData
    : (Array.isArray(customerData.items) ? customerData.items : []);
  const roomItems = Array.isArray(roomData)
    ? roomData
    : (Array.isArray(roomData.items) ? roomData.items : []);

  customerDirectory = customerItems.map(normalizeCustomer);
  roomDirectory = roomItems.map(normalizeRoom);
}

async function fetchInvoiceServices() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const params = new URLSearchParams({
    sortBy: 'updatedAt',
    sortDir: 'desc',
    pageNumber: '1',
    pageSize: '100'
  });

  const response = await fetch(SERVICES_API_URL + '?' + params.toString(), {
    method: 'GET',
    headers: headers
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải danh sách dịch vụ cho hóa đơn.'));
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
  invoiceServicesCatalog = items
    .map(normalizeService)
    .filter(function (service) {
      return String(service.status || '').trim().toLowerCase() !== 'tạm ngưng';
    });
}

async function fetchInvoiceIndex() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(INVOICES_API_URL, {
    method: 'GET',
    headers: headers
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải trạng thái hóa đơn.'));
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
  invoicedBookingIds = new Set(
    items
      .map(function (invoice) { return Number(invoice.bookingId || 0); })
      .filter(function (bookingId) { return bookingId > 0; })
  );
}

function populateCustomerDatalist() {
  const dataList = document.getElementById('customerList');
  if (!dataList) return;

  dataList.innerHTML = customerDirectory.map(function (customer) {
    const value = customer.identityCard || customer.fullName;
    const email = customer.email ? ' - ' + customer.email : '';
    return '<option value="' + value + '">' + customer.fullName + email + '</option>';
  }).join('');

  const manualCustomerInput = document.getElementById('manualCustomer');
  if (manualCustomerInput) {
    manualCustomerInput.setAttribute('list', 'customerList');
  }
}

function populateRoomSelect() {
  const roomSelect = document.getElementById('manualRoomType');
  if (!roomSelect) return;

  const availableRooms = roomDirectory.filter(function (room) {
    const normalizedStatus = String(room.status || '').toLowerCase();
    return normalizedStatus === 'trống' || normalizedStatus === 'available' || normalizedStatus === 'hoạt động' || normalizedStatus === '';
  });

  const sourceRooms = availableRooms.length > 0 ? availableRooms : roomDirectory;

  roomSelect.innerHTML = sourceRooms.map(function (room) {
    const roomLabel = room.cardName + (room.roomType ? ' - ' + room.roomType : '');
    const priceLabel = formatCurrency(room.pricePerNight) + '/đêm';
    return '<option value="' + room.cardName + '">' + roomLabel + ' (' + priceLabel + ')</option>';
  }).join('');
}

function findCustomerFromInput(rawInput) {
  const query = String(rawInput || '').trim().toLowerCase();
  if (!query) return null;

  return customerDirectory.find(function (customer) {
    return (
      String(customer.identityCard || '').toLowerCase() === query ||
      String(customer.fullName || '').toLowerCase() === query ||
      String(customer.phoneNumber || '').toLowerCase() === query ||
      String(customer.email || '').toLowerCase() === query
    );
  }) || null;
}

function splitInsightTokens(value) {
  return String(value || '')
    .split(/[,\n;|]+/)
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean);
}

function normalizeTokenSet(values) {
  return values
    .map(function (item) { return String(item || '').trim().toLowerCase(); })
    .filter(function (item) { return item.length >= 2; });
}

function parseGuestCountLabel(label) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.includes('gia đình')) return 4;
  const match = normalized.match(/\d+/);
  return match ? Number(match[0]) : 2;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function countNights(checkInDate, checkOutDate) {
  const start = normalizeDateOnly(checkInDate);
  const end = normalizeDateOnly(checkOutDate);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function isBookingActiveStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized && normalized !== 'đã hủy' && normalized !== 'cancelled' && normalized !== 'hủy';
}

function isRoomBookedInRange(room, criteria) {
  const desiredCheckIn = normalizeDateOnly(criteria.checkInRaw);
  const desiredCheckOut = normalizeDateOnly(criteria.checkOutRaw);
  if (!desiredCheckIn || !desiredCheckOut) return false;

  return aiBookingInventory.some(function (booking) {
    if (!isBookingActiveStatus(booking.status)) return false;

    const sameRoom = (
      (booking.roomId && room.id && booking.roomId === room.id) ||
      String(booking.roomName || '').toLowerCase() === String(room.cardName || '').toLowerCase()
    );
    if (!sameRoom) return false;

    const bookingCheckIn = normalizeDateOnly(booking.checkInDate);
    const bookingCheckOut = normalizeDateOnly(booking.checkOutDate);
    if (!bookingCheckIn || !bookingCheckOut) return false;

    return desiredCheckIn < bookingCheckOut && desiredCheckOut > bookingCheckIn;
  });
}

function resolveCustomerInsight(rawInput) {
  const matchedCustomer = findCustomerFromInput(rawInput);
  const query = String(rawInput || '').trim().toLowerCase();
  const legacyName = Object.keys(customerProfiles).find(function (name) {
    const profile = customerProfiles[name];
    return (
      name.toLowerCase().includes(query) ||
      String(profile.cccd || '').toLowerCase().includes(query) ||
      String(profile.phone || '').toLowerCase().includes(query)
    );
  });
  const legacyProfile = legacyName ? customerProfiles[legacyName] : null;

  const bookingHistoryCount = pendingBookings.concat(confirmedBookings, localConfirmedBookings).filter(function (booking) {
    if (matchedCustomer && matchedCustomer.fullName) {
      return String(booking.customerName || '').toLowerCase() === String(matchedCustomer.fullName).toLowerCase();
    }
    if (legacyName) {
      return String(booking.customerName || '').toLowerCase() === String(legacyName).toLowerCase();
    }
    return false;
  }).length;

  const preferences = splitInsightTokens(matchedCustomer && matchedCustomer.aiPreferences);
  const fallbackPreferences = legacyProfile ? legacyProfile.preferences : [];

  return {
    matchedCustomer: matchedCustomer,
    displayName: (matchedCustomer && matchedCustomer.fullName) || legacyName || 'Khách chưa định danh',
    email: (matchedCustomer && matchedCustomer.email) || '--',
    cccd: (matchedCustomer && matchedCustomer.identityCard) || (legacyProfile && legacyProfile.cccd) || '--',
    phone: (matchedCustomer && matchedCustomer.phoneNumber) || (legacyProfile && legacyProfile.phone) || '--',
    tier: (legacyProfile && legacyProfile.tier) || ((matchedCustomer && matchedCustomer.status) ? matchedCustomer.status : 'Khách mới'),
    stayCount: Math.max(bookingHistoryCount, Number((legacyProfile && legacyProfile.stayCount) || 0)),
    preferences: preferences.length > 0 ? preferences : fallbackPreferences,
    suggestion: (legacyProfile && legacyProfile.suggestion) || 'Chưa có lịch sử đủ dày để tạo gợi ý điều phối nâng cao.',
    source: matchedCustomer ? 'crm' : (legacyProfile ? 'memory' : 'unknown')
  };
}

function buildBookingHistorySummary(searchQuery) {
  const insight = resolveCustomerInsight(searchQuery);
  const normalizedQuery = String(searchQuery || '').trim().toLowerCase();

  const relatedBookings = pendingBookings.concat(confirmedBookings, localConfirmedBookings).filter(function (booking) {
    const bookingName = String(booking.customerName || '').trim().toLowerCase();
    if (insight.matchedCustomer && insight.matchedCustomer.fullName) {
      return bookingName === String(insight.matchedCustomer.fullName).trim().toLowerCase();
    }
    if (normalizedQuery) {
      const bookingText = [booking.bookingCode, booking.customerName, booking.roomName, booking.roomType, booking.status].join(' ').toLowerCase();
      return bookingText.includes(normalizedQuery);
    }
    return false;
  });

  const sortedRecent = relatedBookings.slice().sort(function (a, b) {
    const leftTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const rightTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return rightTime - leftTime;
  });

  const recentLabels = sortedRecent.slice(0, 5).map(function (booking) {
    return [
      booking.bookingCode || 'BKG',
      booking.roomName || booking.roomType || 'Phòng',
      getWorkflowStatusLabel(booking.status)
    ].join(' • ');
  });

  const roomTypeCounts = relatedBookings.reduce(function (accumulator, booking) {
    const key = String(booking.roomType || booking.roomName || 'Không rõ').trim();
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const topTypes = Object.keys(roomTypeCounts)
    .sort(function (left, right) {
      return roomTypeCounts[right] - roomTypeCounts[left];
    })
    .slice(0, 3)
    .map(function (key) {
      return key + ' (' + roomTypeCounts[key] + ')';
    });

  const summaryParts = [];
  if (relatedBookings.length > 0) {
    summaryParts.push('Khách có ' + relatedBookings.length + ' lượt đặt phòng trong hệ thống.');
  }
  if (recentLabels.length > 0) {
    summaryParts.push('Booking gần đây: ' + recentLabels.join('; ') + '.');
  }
  if (topTypes.length > 0) {
    summaryParts.push('Loại phòng thường đặt: ' + topTypes.join(', ') + '.');
  }

  return {
    totalCount: relatedBookings.length,
    recentLabels: recentLabels,
    topTypes: topTypes,
    summaryText: summaryParts.join(' ') || 'Khách chưa có lịch sử đặt phòng liên quan.'
  };
}

function hashString(input) {
  const source = String(input || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function matchesAnyKeyword(targetText, keywords) {
  const normalized = String(targetText || '').toLowerCase();
  return keywords.some(function (keyword) {
    return normalized.includes(String(keyword || '').toLowerCase());
  });
}

function purposeKeywords(purposeValue) {
  switch (String(purposeValue || '').toLowerCase()) {
    case 'business':
      return ['executive', 'business', 'quiet', 'work', 'city', 'desk', 'meeting'];
    case 'honeymoon':
      return ['suite', 'penthouse', 'ocean', 'garden', 'view', 'private', 'balcony', 'romantic'];
    case 'family':
      return ['family', 'twin', 'large', 'connected', 'kids', 'spacious', 'double'];
    default:
      return [];
  }
}

function guestKeywords(guestCount) {
  if (guestCount >= 4) return ['family', 'suite', 'double', 'connected', 'large', 'spacious', 'twin'];
  if (guestCount === 1) return ['single', 'executive', 'quiet', 'compact'];
  return ['double', 'queen', 'king', 'suite'];
}

function scoreRoomCandidate(room, criteria) {
  let score = 55;

  const roomText = [room.cardName, room.roomType, room.description].join(' ').toLowerCase();
  const budgetLimit = criteria.budgetLimit;
  const unavailableForDates = isRoomBookedInRange(room, criteria);

  if (unavailableForDates) {
    return 0;
  }

  if (budgetLimit > 0) {
    if (room.pricePerNight <= budgetLimit) {
      score += 22;
      const ratio = room.pricePerNight / budgetLimit;
      if (ratio > 0.75 && ratio <= 1) {
        score += 6;
      }
    } else {
      const overRatio = (room.pricePerNight - budgetLimit) / budgetLimit;
      score -= Math.min(25, Math.round(overRatio * 40));
    }
  }

  const purposeTerms = purposeKeywords(criteria.roomPurpose);
  if (purposeTerms.length > 0 && matchesAnyKeyword(roomText, purposeTerms)) {
    score += 14;
  }

  const guestTerms = guestKeywords(criteria.guestCount || 2);
  if (guestTerms.length > 0 && matchesAnyKeyword(roomText, guestTerms)) {
    score += 10;
  }

  if (criteria.promptTokens.length > 0) {
    const promptHits = criteria.promptTokens.filter(function (token) {
      return roomText.includes(token);
    }).length;
    score += Math.min(18, promptHits * 4);
  }

  if (criteria.customerPreferenceTokens.length > 0) {
    const preferenceHits = criteria.customerPreferenceTokens.filter(function (token) {
      return roomText.includes(token);
    }).length;
    score += Math.min(16, preferenceHits * 4);
  }

  const statusScore = String(room.status || '').toLowerCase();
  if (statusScore === 'trống' || statusScore === 'available' || statusScore === 'hoạt động' || statusScore === '') {
    score += 6;
  } else {
    score -= 30;
  }

  if (criteria.stayNights >= 5 && matchesAnyKeyword(roomText, ['suite', 'view', 'balcony', 'spacious'])) {
    score += 6;
  }

  score += (hashString(room.cardName + criteria.seed) % 5) - 2;

  return Math.max(20, Math.min(99, Math.round(score)));
}

function buildRecommendationReason(room, criteria, score) {
  const reasonParts = [];

  if (criteria.budgetLimit > 0) {
    if (room.pricePerNight <= criteria.budgetLimit) {
      reasonParts.push('Phòng nằm trong ngân sách yêu cầu');
    } else {
      reasonParts.push('Phòng vượt ngân sách nhưng có độ phù hợp theo tiện ích và mục đích');
    }
  }

  const purposeLabelMap = {
    business: 'công tác',
    honeymoon: 'nghỉ dưỡng/trăng mật',
    family: 'gia đình'
  };
  const purposeLabel = purposeLabelMap[String(criteria.roomPurpose || '').toLowerCase()];
  if (purposeLabel) {
    reasonParts.push('Khớp nhu cầu chuyến đi: ' + purposeLabel);
  }

  if (criteria.promptTokens.length > 0) {
    reasonParts.push('Đã xét yêu cầu đặc biệt trong prompt của lễ tân');
  }

  if (criteria.customerPreferenceTokens.length > 0) {
    reasonParts.push('Tận dụng dữ liệu sở thích khách hàng từ hồ sơ lưu trú');
  }

  if (criteria.guestCount >= 4) {
    reasonParts.push('Ưu tiên không gian phù hợp nhóm khách đông');
  } else if (criteria.guestCount === 1) {
    reasonParts.push('Ưu tiên bố cục gọn và riêng tư cho khách đơn');
  }

  if (criteria.stayNights >= 5) {
    reasonParts.push('Phù hợp cho kỳ lưu trú dài ngày');
  }

  const summary = reasonParts.length > 0 ? reasonParts.join(', ') : 'Phòng có điểm cân bằng tốt giữa giá, loại phòng và độ sẵn sàng.';
  return '"' + summary + '. Mức độ phù hợp tổng hợp: ' + score + '%."';
}

function inferRoomTags(room, criteria) {
  const tags = [];
  if (room.roomType) {
    tags.push({ label: 'Loại phòng', value: room.roomType });
  }
  tags.push({ label: 'Tình trạng', value: room.status || 'Sẵn sàng' });
  tags.push({
    label: criteria.budgetLimit > 0 && room.pricePerNight <= criteria.budgetLimit ? 'Ngân sách' : 'Giá/đêm',
    value: criteria.budgetLimit > 0 && room.pricePerNight <= criteria.budgetLimit ? 'Trong ngân sách' : formatCurrency(room.pricePerNight)
  });
  if (criteria.stayNights > 0) {
    tags.push({ label: 'Lưu trú', value: criteria.stayNights + ' đêm' });
  }
  return tags.slice(0, 3);
}

function buildRankedRoomOptions(criteria, limit) {
  const maxItems = Number(limit || 3);
  if (!roomDirectory || roomDirectory.length === 0) {
    return aiRoomOptions.slice(0, maxItems).map(function (option, index) {
      return {
        id: option.id,
        name: option.name,
        roomType: index === 0 ? 'Suite' : 'Phòng cao cấp',
        priceValue: Number(String(option.price).replace(/\./g, '').replace(/,/g, '')) || 0,
        priceDisplay: option.price + ' VNĐ',
        matchScore: Number(String(option.match).replace('%', '')) || 0,
        match: option.match,
        img: option.img,
        reason: option.reason,
        engine: 'fallback',
        status: 'Sẵn sàng',
        description: '',
        tags: []
      };
    });
  }

  return roomDirectory
    .map(function (room, index) {
      const score = scoreRoomCandidate(room, criteria);
      return {
        id: 'api-room-' + String(room.id || index),
        name: room.cardName || 'Gợi ý từ AI',
        roomType: room.roomType || 'Phòng',
        priceValue: Number(room.pricePerNight || 0),
        priceDisplay: formatCurrency(room.pricePerNight),
        matchScore: score,
        match: String(score) + '%',
        img: aiFallbackImages[index % aiFallbackImages.length],
        reason: buildRecommendationReason(room, criteria, score),
        engine: 'rule',
        status: room.status || 'Sẵn sàng',
        description: room.description || '',
        tags: inferRoomTags(room, criteria)
      };
    })
    .filter(function (option) {
      return option.matchScore > 0;
    })
    .sort(function (a, b) {
      return b.matchScore - a.matchScore;
    })
    .slice(0, maxItems);
}

function buildAIMatchOption(criteria) {
  const options = buildRankedRoomOptions(criteria, 1);
  if (options.length > 0) return options[0];
  return {
    id: 'no-room-available',
    name: 'Không còn phòng phù hợp',
    roomType: 'Tạm hết phòng',
    priceValue: 0,
    priceDisplay: 'Liên hệ lễ tân',
    matchScore: 0,
    match: '0%',
    img: aiFallbackImages[0],
    reason: 'Không tìm thấy phòng vừa khớp ngân sách vừa còn trống trong khoảng ngày đã chọn.',
    engine: 'rule',
    status: 'Không khả dụng',
    description: 'Cần đổi ngày lưu trú, nới ngân sách hoặc kiểm tra lại tồn kho phòng.',
    tags: [
      { label: 'Tình trạng', value: 'Hết phòng trong kỳ này' },
      { label: 'Khuyến nghị', value: 'Điều chỉnh tiêu chí' }
    ]
  };
}

async function fetchAiRecommendation(input) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(BOOKING_AI_API_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      customerQuery: input.customerQuery,
      budgetLimit: input.budgetLimit,
      roomPurpose: input.roomPurpose,
      aiPrompt: input.aiPrompt,
      bookingHistorySummary: input.bookingHistorySummary || null,
      checkInDate: input.checkInDate || null,
      checkOutDate: input.checkOutDate || null,
      guestCount: input.guestCount || null
    })
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể xử lý gợi ý AI từ backend.'));
  }

  const data = await response.json();
  if (!data || !data.recommendation) {
    throw new Error('Backend AI không trả về kết quả hợp lệ.');
  }

  function mapBackendOption(rec, index) {
    const matchedRoom = roomDirectory.find(function (room) {
      return (
        (Number(rec.roomId || 0) > 0 && Number(room.id || 0) === Number(rec.roomId || 0)) ||
        String(room.cardName || '').toLowerCase() === String(rec.roomName || '').toLowerCase()
      );
    }) || null;

    const priceValue = Number(rec.pricePerNight || 0);
    const roomName = rec.roomName || (matchedRoom && matchedRoom.cardName) || 'Gợi ý từ AI';
    const roomType = rec.roomType || (matchedRoom && matchedRoom.roomType) || 'Phòng gợi ý';
    const roomStatus = rec.status || (matchedRoom && matchedRoom.status) || 'Sẵn sàng';

    return {
      id: 'be-ai-room-' + String(rec.roomId || index || 0),
      roomId: Number(rec.roomId || 0),
      name: roomName,
      roomType: roomType,
      priceValue: priceValue,
      priceDisplay: priceValue > 0 ? formatCurrency(priceValue) : 'Liên hệ lễ tân',
      match: String(rec.matchScore || 0) + '%',
      matchScore: Number(rec.matchScore || 0),
      img: rec.imageUrl || aiFallbackImages[index % aiFallbackImages.length],
      reason: rec.reason || 'AI đã chọn phòng phù hợp nhất từ dữ liệu hiện tại.',
      engine: data.engine || 'rule',
      status: roomStatus,
      description: (matchedRoom && matchedRoom.description) || '',
      tags: [
        roomType ? { label: 'Loại phòng', value: roomType } : null,
        { label: 'Tình trạng', value: roomStatus },
        { label: 'Giá/đêm', value: priceValue > 0 ? formatCurrency(priceValue) : 'Liên hệ lễ tân' }
      ].filter(Boolean)
    };
  }

  const bestOption = mapBackendOption(data.recommendation, 0);
  const alternatives = Array.isArray(data.topRooms)
    ? data.topRooms
      .filter(function (item) {
        return Number(item.roomId || 0) !== Number(data.recommendation.roomId || 0);
      })
      .slice(0, 2)
      .map(function (item, index) {
        return mapBackendOption(item, index + 1);
      })
    : [];

  return {
    customerName: (data.customer && data.customer.fullName) || input.customerQuery,
    bestOption: bestOption,
    alternatives: alternatives,
    engine: data.engine || 'rule'
  };
}

async function loadAndRenderPendingBookings() {
  try {
    pendingBookings = await fetchBookingList(pendingQueryState, pendingPagingState);

    if (pendingQueryState.pageNumber > pendingPagingState.totalPages) {
      pendingQueryState.pageNumber = pendingPagingState.totalPages;
      pendingBookings = await fetchBookingList(pendingQueryState, pendingPagingState);
    }

    renderBookingRequests();
  } catch (error) {
    pendingBookings = [];
    pendingPagingState.totalCount = 0;
    pendingPagingState.totalPages = 1;
    pendingPagingState.hasNextPage = false;
    pendingPagingState.hasPreviousPage = false;
    renderBookingRequests();
    showToast(error.message || 'Lỗi tải booking chờ xử lý.', 'error');
  }
}

async function loadAndRenderConfirmedBookings() {
  try {
    confirmedBookings = await fetchBookingList(confirmedQueryState, confirmedPagingState);

    if (confirmedQueryState.pageNumber > confirmedPagingState.totalPages) {
      confirmedQueryState.pageNumber = confirmedPagingState.totalPages;
      confirmedBookings = await fetchBookingList(confirmedQueryState, confirmedPagingState);
    }

    renderConfirmedBookings();
  } catch (error) {
    confirmedBookings = [];
    confirmedPagingState.totalCount = 0;
    confirmedPagingState.totalPages = 1;
    confirmedPagingState.hasNextPage = false;
    confirmedPagingState.hasPreviousPage = false;
    renderConfirmedBookings();
    showToast(error.message || 'Lỗi tải booking đã xác nhận.', 'error');
  }
}

function renderBookingRequests() {
  const tbody = document.getElementById('bookingRequestsBody');
  const pendingCountBadge = document.getElementById('pendingBookingCount');
  const totalPending = document.getElementById('totalPending');
  if (!tbody) return;

  if (pendingCountBadge) {
    pendingCountBadge.innerText = String(pendingPagingState.totalCount) + ' yêu cầu mới';
    pendingCountBadge.style.display = pendingPagingState.totalCount > 0 ? 'inline-block' : 'none';
  }
  if (totalPending) {
    totalPending.innerText = String(pendingPagingState.totalCount);
  }

  const pendingItems = pendingBookings.filter(function (booking) {
    return isPendingWorkflowStatus(booking.status);
  });

  if (pendingCountBadge) {
    pendingCountBadge.innerText = String(pendingItems.length) + ' yêu cầu mới';
    pendingCountBadge.style.display = pendingItems.length > 0 ? 'inline-block' : 'none';
  }
  if (totalPending) {
    totalPending.innerText = String(pendingItems.length);
  }

  if (pendingItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--dash-muted); padding: 40px 0;">Không còn yêu cầu chờ xử lý.</td></tr>';
  } else {
    tbody.innerHTML = pendingItems.map(function (req) {
      return '\
        <tr>\
          <td style="font-family: var(--f-mono); font-weight: 600; color: #2563eb; padding-left: 32px;">' + req.bookingCode + '</td>\
          <td>\
            <div style="font-weight: 600;">' + req.customerName + '</div>\
          </td>\
          <td>' + req.roomName + '</td>\
          <td>' + formatDateTime(req.createdAt) + '</td>\
          <td><span class="notion-pill" style="' + getWorkflowStatusPillStyle(req.status) + '">' + getWorkflowStatusLabel(req.status) + '</span></td>\
          <td style="text-align: right; padding-right: 32px;">\
            <button class="btn-luxe-primary" style="padding: 4px 16px; height: 32px; font-size: 12px; justify-content: center; display: flex;" onclick="processBooking(' + req.id + ')">Xác nhận</button>\
          </td>\
        </tr>';
    }).join('');
  }

  const pageInfoEl = document.getElementById('pendingPageInfo');
  if (pageInfoEl) {
    pageInfoEl.innerText = 'Trang ' + pendingQueryState.pageNumber + '/' + pendingPagingState.totalPages;
  }

  const prevBtn = document.getElementById('btnPrevPending');
  if (prevBtn) prevBtn.disabled = !pendingPagingState.hasPreviousPage;

  const nextBtn = document.getElementById('btnNextPending');
  if (nextBtn) nextBtn.disabled = !pendingPagingState.hasNextPage;
}

function renderConfirmedBookings() {
  const tbody = document.getElementById('confirmedBookingsBody');
  const countEl = document.getElementById('confirmedCount');
  const totalConfirmedEl = document.getElementById('totalConfirmed');
  if (!tbody) return;

  const mergedConfirmed = localConfirmedBookings.concat(confirmedBookings).filter(function (booking) {
    return isConfirmedWorkflowStatus(booking.status);
  });

  if (countEl) {
    countEl.innerText = String(mergedConfirmed.length) + ' đã xử lý';
  }
  if (totalConfirmedEl) {
    totalConfirmedEl.innerText = String(mergedConfirmed.length);
  }

  if (mergedConfirmed.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--dash-muted); padding: 48px 0;">Chưa có giao dịch nào được xác nhận trong phiên làm việc này.</td></tr>';
  } else {
    tbody.innerHTML = mergedConfirmed.map(function (b) {
      const isInvoiced = Number(b.id || 0) > 0 && invoicedBookingIds.has(Number(b.id || 0));
      const isCheckedIn = normalizeWorkflowStatus(b.status) === 'đã check-in' || normalizeWorkflowStatus(b.status) === 'da check-in';
      const isReserved = normalizeWorkflowStatus(b.status) === 'đã xác nhận giữ chỗ' || normalizeWorkflowStatus(b.status) === 'da xac nhan giu cho';
      return '\
        <tr>\
          <td style="font-family: var(--f-mono); font-weight: 600; color: #2563eb; padding-left: 32px;">' + b.bookingCode + '</td>\
          <td><div style="font-weight: 600;">' + b.customerName + '</div></td>\
          <td>' + b.roomName + '</td>\
          <td>' + formatDateTime(b.updatedAt || b.createdAt) + '</td>\
          <td style="font-family: var(--f-mono); font-weight: 600; color: #0d7350;">' + formatCurrency(b.totalRoomAmount) + '</td>\
          <td><span class="notion-pill" style="' + getWorkflowStatusPillStyle(b.status) + '">' + getWorkflowStatusLabel(b.status) + '</span></td>\
          <td style="text-align: right; padding-right: 32px;">\
            <div style="display:flex; justify-content:flex-end; gap:8px;">\
              ' + (isReserved
                ? '<button class="btn-luxe-primary" style="padding: 4px 12px; height: 32px; font-size: 12px; justify-content: center; display: inline-flex;" onclick="markBookingCheckedIn(' + Number(b.id || 0) + ')">Check-in</button>'
                : '') + '\
              <button class="btn-luxe-sec" style="padding: 4px 12px; height: 32px; font-size: 12px; justify-content: center; display: inline-flex; ' + (isInvoiced ? 'opacity:0.55; cursor:not-allowed;' : '') + '" ' + (isInvoiced ? 'disabled' : 'onclick="openInvoiceForBooking(\'' + escapeJsString(b.bookingCode || '') + '\')"') + '>' + (isInvoiced ? 'Đã có hóa đơn' : 'Tạo hóa đơn') + '</button>\
            </div>\
          </td>\
        </tr>';
    }).join('');
  }

  const pageInfoEl = document.getElementById('confirmedPageInfo');
  if (pageInfoEl) {
    pageInfoEl.innerText = 'Trang ' + confirmedQueryState.pageNumber + '/' + confirmedPagingState.totalPages;
  }

  const prevBtn = document.getElementById('btnPrevConfirmed');
  if (prevBtn) prevBtn.disabled = !confirmedPagingState.hasPreviousPage;

  const nextBtn = document.getElementById('btnNextConfirmed');
  if (nextBtn) nextBtn.disabled = !confirmedPagingState.hasNextPage;
}

function renderBookingInvoiceServiceOptions(selectedServices) {
  const container = document.getElementById('bookingInvoiceServicesList');
  if (!container) return;

  const selected = Array.isArray(selectedServices) ? selectedServices : [];
  if (!invoiceServicesCatalog.length) {
    container.innerHTML = '<span style="font-size: 13px; color: var(--dash-muted);">Chưa có dịch vụ khả dụng từ hệ thống.</span>';
    return;
  }

  container.innerHTML = invoiceServicesCatalog.map(function (service) {
    const checked = selected.includes(service.name) ? ' checked' : '';
    return '<label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">'
      + '<input type="checkbox" class="booking-invoice-service" value="' + escapeHtml(service.name) + '" data-price="' + Number(service.price || 0) + '"' + checked + '>'
      + escapeHtml(service.name) + ' (' + formatCurrency(service.price) + ')'
      + '</label>';
  }).join('');
}

function formatDateOnlyForInvoice(dateValue) {
  if (!dateValue) {
    return new Date().toISOString().split('T')[0].split('-').reverse().join('/');
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0].split('-').reverse().join('/');
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return day + '/' + month + '/' + year;
}

function parseUiDateToIso(uiDate) {
  const parts = String(uiDate || '').split('/');
  if (parts.length !== 3) return new Date().toISOString();
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  return year + '-' + month + '-' + day + 'T00:00:00.000Z';
}

function toApiPaymentStatus(uiStatus) {
  if (uiStatus === 'Đã thanh toán') return 'Đã thanh toán';
  if (uiStatus === 'Quá hạn') return 'Quá hạn';
  return 'Chưa thanh toán';
}

function getSelectedBookingInvoiceServices() {
  return Array.from(document.querySelectorAll('.booking-invoice-service:checked')).map(function (checkbox) {
    return checkbox.value;
  });
}

function fillBookingInvoiceForm(customer, booking) {
  const lookupEl = document.getElementById('bookingInvoiceLookup');
  const customerEl = document.getElementById('bookingInvoiceCustomer');
  const cccdEl = document.getElementById('bookingInvoiceCccd');
  const roomEl = document.getElementById('bookingInvoiceRoom');
  const dateEl = document.getElementById('bookingInvoiceDate');
  const amountEl = document.getElementById('bookingInvoiceAmount');

  if (lookupEl) lookupEl.value = customer ? (customer.identityCard || '') : '';
  if (customerEl) customerEl.value = customer ? (customer.fullName || '') : (booking.customerName || '');
  if (cccdEl) cccdEl.value = customer ? (customer.identityCard || '') : '';
  if (roomEl) roomEl.value = booking.roomName || '';
  if (dateEl) dateEl.value = formatDateOnlyForInvoice(new Date().toISOString());

  invoiceBaseAmount = Number(booking.totalRoomAmount || 0);
  if (amountEl) amountEl.value = invoiceBaseAmount;

  renderBookingInvoiceServiceOptions([]);
}

function calculateBookingInvoiceTotal() {
  const amountEl = document.getElementById('bookingInvoiceAmount');
  if (!amountEl) return;

  let total = Number(invoiceBaseAmount || 0);
  document.querySelectorAll('.booking-invoice-service:checked').forEach(function (checkbox) {
    total += Number(checkbox.getAttribute('data-price') || 0);
  });
  amountEl.value = total;
}

window.openInvoiceForBooking = function (bookingCode) {
  const booking = localConfirmedBookings.concat(confirmedBookings).find(function (item) {
    return String(item.bookingCode || '').trim().toLowerCase() === String(bookingCode || '').trim().toLowerCase();
  }) || null;

  if (!booking) {
    showToast('Không tìm thấy booking để tạo hóa đơn.', 'error');
    return;
  }

  const customer = findCustomerByBooking(booking);
  const modal = document.getElementById('bookingInvoiceModal');
  const cccdList = document.getElementById('bookingInvoiceCccdList');
  const statusEl = document.getElementById('bookingInvoiceStatus');

  activeInvoiceBookingCode = booking.bookingCode || null;
  fillBookingInvoiceForm(customer, booking);

  if (statusEl) {
    statusEl.value = 'Chưa thanh toán';
  }

  if (cccdList) {
    cccdList.innerHTML = customerDirectory.map(function (item) {
      return '<option value="' + escapeHtml(item.identityCard || '') + '">' + escapeHtml(item.fullName || '') + '</option>';
    }).join('');
  }

  if (modal) {
    modal.style.display = 'flex';
  }
};

window.closeBookingInvoiceModal = function () {
  const modal = document.getElementById('bookingInvoiceModal');
  if (modal) {
    modal.style.display = 'none';
  }
  activeInvoiceBookingCode = null;
  invoiceBaseAmount = 0;
};

window.handleBookingInvoiceLookup = function () {
  const lookupEl = document.getElementById('bookingInvoiceLookup');
  const cccd = String(lookupEl ? lookupEl.value : '').trim().toLowerCase();
  const customer = customerDirectory.find(function (item) {
    return String(item.identityCard || '').trim().toLowerCase() === cccd;
  }) || null;

  if (!customer) {
    showToast('Không tìm thấy khách hàng với CCCD này.', 'error');
    return;
  }

  const booking = localConfirmedBookings.concat(confirmedBookings).find(function (item) {
    return (
      (customer.id && Number(item.customerId || 0) === Number(customer.id || 0)) &&
      (!activeInvoiceBookingCode || String(item.bookingCode || '') === String(activeInvoiceBookingCode || ''))
    );
  }) || localConfirmedBookings.concat(confirmedBookings).find(function (item) {
    return customer.id && Number(item.customerId || 0) === Number(customer.id || 0);
  }) || null;

  if (!booking) {
    showToast('Không tìm thấy booking tương ứng cho CCCD này.', 'error');
    return;
  }

  activeInvoiceBookingCode = booking.bookingCode || activeInvoiceBookingCode;
  fillBookingInvoiceForm(customer, booking);
  showToast('Đã tự động lấy thông tin hóa đơn từ booking.', 'success');
};

async function saveBookingInvoice(event) {
  event.preventDefault();
  var validation = window.AppCore && window.AppCore.Validation;
  if (validation && !validation.validateFields(event.target, [
    {
      input: '#bookingInvoiceCustomer',
      validate: function(value) {
        return validation.normalizeText(value).length >= 2 ? '' : 'Tên khách hàng phải có ít nhất 2 ký tự.';
      }
    },
    {
      input: '#bookingInvoiceCccd',
      validate: function(value) {
        return validation.isValidIdentityCard(value) ? '' : 'CCCD phải gồm 9 hoặc 12 chữ số.';
      }
    },
    {
      input: '#bookingInvoiceRoom',
      validate: function(value) {
        return validation.normalizeText(value) ? '' : 'Vui lòng nhập phòng lưu trú.';
      }
    },
    {
      input: '#bookingInvoiceDate',
      validate: function(value) {
        return validation.parseFlexibleDate(value) ? '' : 'Ngày lập hóa đơn không hợp lệ.';
      }
    },
    {
      input: '#bookingInvoiceAmount',
      validate: function(value) {
        return validation.isPositiveNumber(value) ? '' : 'Tổng tiền phải lớn hơn 0.';
      }
    },
    {
      input: '#bookingInvoiceStatus',
      validate: function(value) {
        return validation.normalizeText(value) ? '' : 'Vui lòng chọn trạng thái.';
      }
    }
  ])) {
    return;
  }

  const booking = localConfirmedBookings.concat(confirmedBookings).find(function (item) {
    return String(item.bookingCode || '') === String(activeInvoiceBookingCode || '');
  }) || null;

  if (!booking) {
    showToast('Không tìm thấy booking nguồn để tạo hóa đơn.', 'error');
    return;
  }

  const customerName = document.getElementById('bookingInvoiceCustomer') ? document.getElementById('bookingInvoiceCustomer').value.trim() : '';
  const cccd = document.getElementById('bookingInvoiceCccd') ? document.getElementById('bookingInvoiceCccd').value.trim() : '';
  const roomName = document.getElementById('bookingInvoiceRoom') ? document.getElementById('bookingInvoiceRoom').value.trim() : '';
  const invoiceDate = document.getElementById('bookingInvoiceDate') ? document.getElementById('bookingInvoiceDate').value.trim() : '';
  const totalAmount = document.getElementById('bookingInvoiceAmount') ? Number(document.getElementById('bookingInvoiceAmount').value || 0) : 0;
  const paymentStatus = document.getElementById('bookingInvoiceStatus') ? document.getElementById('bookingInvoiceStatus').value : 'Chưa thanh toán';
  const selectedServices = getSelectedBookingInvoiceServices();

  const matchedCustomer = customerDirectory.find(function (customer) {
    return (
      (cccd && String(customer.identityCard || '').trim().toLowerCase() === cccd.toLowerCase()) ||
      String(customer.fullName || '').trim().toLowerCase() === customerName.toLowerCase()
    );
  }) || null;

  if (!matchedCustomer) {
    showToast('Không tìm thấy khách hàng trong hệ thống. Vui lòng kiểm tra CCCD.', 'error');
    return;
  }

  const subtotalServices = selectedServices.reduce(function (sum, serviceName) {
    const service = invoiceServicesCatalog.find(function (item) {
      return item.name === serviceName;
    });
    return sum + Number((service && service.price) || 0);
  }, 0);

  const payload = {
    invoiceCode: 'INV-' + Date.now(),
    bookingId: Number(booking.id || 0),
    customerId: Number(matchedCustomer.id || 0),
    accountId: getCurrentAccountId(),
    subtotalRoom: Math.max(0, totalAmount - subtotalServices),
    subtotalServices: subtotalServices,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: totalAmount,
    paymentMethod: 'Tiền mặt',
    paymentStatus: toApiPaymentStatus(paymentStatus),
    issuedAt: parseUiDateToIso(invoiceDate)
  };

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(INVOICES_API_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    showToast(await extractApiError(response, 'Không thể tạo hóa đơn.'), 'error');
    return;
  }

  await fetchInvoiceIndex();
  renderConfirmedBookings();
  closeBookingInvoiceModal();
  showToast('Tạo hóa đơn thành công.', 'success');
};

window.processBooking = async function (id) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    const response = await fetch(BOOKING_API_URL + '/' + id + '/status', {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        status: 'Đã xác nhận giữ chỗ',
        accountId: getCurrentAccountId()
      })
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Không thể cập nhật trạng thái booking.'));
    }

    showToast('Đã xác nhận giữ chỗ cho booking.');
    await Promise.all([loadAndRenderPendingBookings(), loadAndRenderConfirmedBookings()]);
  } catch (error) {
    showToast(error.message || 'Lỗi xử lý booking.', 'error');
  }
};

window.markBookingCheckedIn = async function (id) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  try {
    const response = await fetch(BOOKING_API_URL + '/' + id + '/status', {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        status: 'Đã check-in',
        accountId: getCurrentAccountId()
      })
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Không thể cập nhật trạng thái check-in.'));
    }

    showToast('Đã chuyển booking sang trạng thái check-in.');
    await Promise.all([loadAndRenderPendingBookings(), loadAndRenderConfirmedBookings(), fetchInvoiceIndex()]);
  } catch (error) {
    showToast(error.message || 'Lỗi cập nhật check-in.', 'error');
  }
};

function renderAILoading() {
  const container = document.getElementById('aiResultsContainer');
  if (!container) return;
  container.innerHTML = '\
    <div class="luxury-card" style="padding: 28px;">\
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">\
        <span class="material-symbols-outlined rotate" style="color: var(--dash-accent); font-size: 20px;">sync</span>\
        <h2 style="font-size: 22px; font-weight: 700; margin: 0;">Đang phân tích đề xuất AI</h2>\
      </div>\
      <p style="font-size: 14px; color: var(--dash-muted); line-height: 1.7; margin: 0;">Hệ thống đang đối chiếu hồ sơ khách hàng, ngân sách, mục đích lưu trú và tồn kho phòng hiện có.</p>\
    </div>';
}

function updateAIInsights(searchQuery, promptQuery, context) {
  const container = document.getElementById('aiInsightsContainer');
  if (!container) return;

  const insight = resolveCustomerInsight(searchQuery);
  const historySummary = buildBookingHistorySummary(searchQuery);
  const criteria = (context && context.criteria) || {};
  const recognizedBy = insight.source === 'crm'
    ? 'Nhận diện từ CRM'
    : (insight.source === 'memory' ? 'Gợi ý từ hồ sơ mẫu' : 'Không có hồ sơ đầy đủ');
  const criteriaItems = [
    criteria.budgetLimit > 0 ? 'Ngân sách tối đa ' + formatCurrency(criteria.budgetLimit) + '/đêm.' : 'Không đặt ngưỡng ngân sách cứng.',
    criteria.roomPurposeLabel && criteria.roomPurposeLabel !== 'Tất cả (AI tự phân tích)' ? 'Ưu tiên mục đích lưu trú: ' + criteria.roomPurposeLabel + '.' : 'AI tự suy luận loại phòng phù hợp theo hồ sơ và prompt.',
    criteria.guestLabel ? 'Quy mô đoàn khách: ' + criteria.guestLabel + '.' : '',
    criteria.stayNights > 0 ? 'Thời gian ở ' + criteria.stayNights + ' đêm, từ ' + escapeHtml(criteria.checkInLabel || '--') + ' đến ' + escapeHtml(criteria.checkOutLabel || '--') + '.' : '',
    historySummary.totalCount > 0 ? escapeHtml(historySummary.summaryText) : 'Chưa có lịch sử đặt phòng liên quan trong hệ thống.',
    promptQuery ? 'Yêu cầu bổ sung: "' + escapeHtml(promptQuery) + '".' : 'Không có prompt bổ sung từ lễ tân.'
  ].filter(Boolean);

  const preferences = insight.preferences.length > 0
    ? insight.preferences
    : ['Chưa có dữ liệu sở thích cấu trúc. AI sẽ ưu tiên theo ngân sách, lịch sử đặt phòng và mục đích lưu trú.'];

  container.innerHTML = '\
    <div class="notion-ai-box">\
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:18px;">\
        <div style="display:flex; align-items:center; gap:10px;">\
          <span class="material-symbols-outlined" style="color:#79c2ff;">auto_awesome</span>\
          <span style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">AI Insights</span>\
        </div>\
        <span class="notion-pill" style="background: rgba(121,194,255,0.12); color: white; border: 1px solid rgba(121,194,255,0.16);">' + recognizedBy + '</span>\
      </div>\
      <div class="ai-insight-stack">\
        <div class="ai-insight-card">\
          <div class="ai-section-label">Hồ sơ khách hàng</div>\
          <div style="font-size:20px; font-weight:800; letter-spacing:-0.03em; color:#fff;">' + escapeHtml(insight.displayName) + '</div>\
          <div style="font-size:13px; color:rgba(255,255,255,0.7); margin-top:6px; line-height:1.6;">CCCD: ' + escapeHtml(insight.cccd) + '<br>Email: ' + escapeHtml(insight.email) + '<br>SĐT: ' + escapeHtml(insight.phone) + '</div>\
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;">\
            <span class="notion-pill" style="background: rgba(255,255,255,0.08); color: white;">' + insight.stayCount + ' lượt lưu trú</span>\
            <span class="notion-pill" style="background: rgba(197,160,89,0.18); color: #f6d68c;">' + escapeHtml(insight.tier) + '</span>\
          </div>\
        </div>\
        <div class="ai-insight-card">\
          <div class="ai-section-label">Tín hiệu AI dùng để xếp hạng</div>\
          <div class="ai-criteria-list">' + criteriaItems.map(function (item) {
            return '<div class="ai-criteria-item"><span class="material-symbols-outlined">subdirectory_arrow_right</span><span>' + item + '</span></div>';
          }).join('') + '</div>\
        </div>\
        <div class="ai-insight-card">\
          <div class="ai-section-label">Sở thích và ưu tiên</div>\
          <div class="ai-preference-list">' + preferences.map(function (item) {
            return '<div class="ai-preference-item"><span class="material-symbols-outlined">star</span><span>' + escapeHtml(item) + '</span></div>';
          }).join('') + '</div>\
        </div>\
        <div class="ai-insight-card">\
          <div class="ai-section-label">Gợi ý điều phối</div>\
          <div style="font-size:13px; line-height:1.7; color:rgba(255,255,255,0.88);">' + escapeHtml(insight.suggestion) + '</div>\
        </div>\
      </div>\
    </div>';
}

function renderAIResults(payload) {
  const container = document.getElementById('aiResultsContainer');
  if (!container || !payload || !payload.bestOption) return;

  const best = payload.bestOption;
  const alternatives = Array.isArray(payload.alternatives) ? payload.alternatives.slice(0, 2) : [];
  const canBookBest = Number(best.priceValue || 0) > 0;
  const budgetDelta = payload.criteria && payload.criteria.budgetLimit > 0
    ? (best.priceValue <= payload.criteria.budgetLimit
      ? 'Tiết kiệm ' + formatCurrency(payload.criteria.budgetLimit - best.priceValue) + ' so với trần'
      : 'Vượt ' + formatCurrency(best.priceValue - payload.criteria.budgetLimit) + ' so với trần')
    : 'Không giới hạn ngân sách';
  const matchLabel = best.match || (String(best.matchScore || 0) + '%');

  container.innerHTML = '\
    <div class="room-match-card">\
      <img src="' + escapeHtml(best.img) + '" style="width: 100%; height: 100%; object-fit: cover;" alt="' + escapeHtml(best.name) + '"/>\
      <div style="padding: 32px;">\
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">\
          <span class="notion-pill" style="background:#e7f3ef; color:#0d7350;">Phương án tốt nhất • ' + escapeHtml(matchLabel) + '</span>\
          <span style="font-size:12px; color:var(--dash-muted); text-transform:uppercase; font-weight:700;">' + escapeHtml(best.roomType || 'Phòng gợi ý') + '</span>\
        </div>\
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:18px;">\
          <div>\
            <h3 style="font-size:28px; font-weight:800; letter-spacing:-0.03em; margin:0 0 6px;">' + escapeHtml(best.name) + '</h3>\
            <p style="font-size:14px; color:var(--dash-muted); margin:0;">' + escapeHtml(best.description || 'Phòng được chọn vì có độ cân bằng tốt nhất giữa giá, nhu cầu lưu trú và dữ liệu hồ sơ khách.') + '</p>\
          </div>\
          <div style="text-align:right; min-width:160px;">\
            <div style="font-size:12px; color:var(--dash-muted); text-transform:uppercase; font-weight:700; margin-bottom:4px;">Giá đề xuất</div>\
            <div style="font-size:28px; font-weight:800; letter-spacing:-0.03em; color:var(--dash-text);">' + escapeHtml(best.priceDisplay || formatCurrency(best.priceValue)) + '</div>\
          </div>\
        </div>\
        <div class="ai-tag-row">' + (best.tags || []).map(function (tag) {
          return '<div class="ai-tag">' + escapeHtml(tag.label) + '<strong>' + escapeHtml(tag.value) + '</strong></div>';
        }).join('') + '</div>\
        <div class="ai-reason-box">' + escapeHtml(best.reason) + '</div>\
        <div class="ai-meta-list">\
          <div class="ai-meta-item">Động cơ chọn<strong>' + escapeHtml(payload.criteria && payload.criteria.roomPurposeLabel ? payload.criteria.roomPurposeLabel : 'Phù hợp tổng thể') + '</strong></div>\
          <div class="ai-meta-item">Khách áp dụng<strong>' + escapeHtml(payload.customerName || 'Khách hiện tại') + '</strong></div>\
        </div>\
        <div style="display:flex; gap:12px; margin-top:20px;">\
          <button class="btn-luxe-primary" style="flex: 1; justify-content: center; ' + (canBookBest ? '' : 'opacity:0.55; cursor:not-allowed;') + '" ' + (canBookBest ? 'onclick="bookNow(\'' + escapeJsString(best.name) + '\', ' + Number(best.priceValue || 0) + ', \'' + escapeJsString(payload.customerName || '') + '\')"' : 'disabled') + '>Đặt phòng ngay</button>\
        </div>\
      </div>\
    </div>\
    ' + (alternatives.length > 0 ? '<div><div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px;"><h3 style="font-size:18px; font-weight:700; margin:0;">Phương án thay thế</h3><span style="font-size:13px; color:var(--dash-muted);">So sánh nhanh các lựa chọn kế tiếp trong bảng xếp hạng.</span></div><div class="ai-alt-grid">' + alternatives.map(function (option) {
      return '<div class="ai-alt-card">\
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px;">\
          <div><p style="font-size:18px; font-weight:700; color:var(--dash-text);">' + escapeHtml(option.name) + '</p><p style="font-size:13px; color:var(--dash-muted); margin-top:4px;">' + escapeHtml(option.roomType || 'Phòng thay thế') + '</p></div>\
          <span class="notion-pill" style="background:#f8fafc; color:#0f172a;">' + escapeHtml(option.match || (String(option.matchScore || 0) + '%')) + '</span>\
        </div>\
        <p style="font-size:22px; font-weight:800; letter-spacing:-0.03em; color:var(--dash-text); margin-bottom:12px;">' + escapeHtml(option.priceDisplay || formatCurrency(option.priceValue)) + '</p>\
        <p style="font-size:13px; color:var(--dash-muted); line-height:1.7; margin-bottom:18px;">' + escapeHtml(option.reason) + '</p>\
        <button class="btn-luxe-sec" style="width:100%; justify-content:center;" onclick="bookNow(\'' + escapeJsString(option.name) + '\', ' + Number(option.priceValue || 0) + ', \'' + escapeJsString(payload.customerName || '') + '\')">Chọn phương án này</button>\
      </div>';
    }).join('') + '</div></div>' : '') + '\
  ';
}

window.bookNow = async function (roomName, priceValue, customerName) {
  const searchQuery = customerName || (document.getElementById('customerSearchInput') ? document.getElementById('customerSearchInput').value : '') || 'Khách vãng lai';
  const matchedCustomer = findCustomerFromInput(searchQuery);
  const matchedRoom = roomDirectory.find(function (room) {
    return String(room.cardName || '').toLowerCase() === String(roomName || '').toLowerCase();
  }) || null;
  const checkInRaw = document.getElementById('checkInDate') ? document.getElementById('checkInDate').value : '';
  const checkOutRaw = document.getElementById('checkOutDate') ? document.getElementById('checkOutDate').value : '';

  const query = searchQuery.toLowerCase();
  const resolvedFromProfile = Object.keys(customerProfiles).find(function (name) {
    const profile = customerProfiles[name];
    return profile.cccd.includes(query) || name.toLowerCase().includes(query) || profile.phone.includes(query);
  });
  const resolvedName = (matchedCustomer && matchedCustomer.fullName)
    || resolvedFromProfile
    || searchQuery.split('(')[0].trim();

  if (!matchedCustomer || !matchedCustomer.id) {
    showToast('Không thể lưu booking: chưa xác định được khách hàng trong hệ thống theo CCCD/tên đã nhập.', 'error');
    return;
  }

  if (!matchedRoom || !matchedRoom.id) {
    showToast('Không thể lưu booking: chưa xác định được phòng trong hệ thống.', 'error');
    return;
  }

  if (!checkInRaw || !checkOutRaw) {
    showToast('Không thể lưu booking: vui lòng chọn ngày nhận và ngày trả phòng.', 'error');
    return;
  }

  const stayNights = countNights(checkInRaw, checkOutRaw);
  if (stayNights <= 0) {
    showToast('Không thể lưu booking: ngày trả phải sau ngày nhận phòng.', 'error');
    return;
  }

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const generatedBookingCode = 'BKG-' + Date.now();
  const payload = {
    bookingCode: generatedBookingCode,
    customerId: Number(matchedCustomer.id || 0),
    roomId: Number(matchedRoom.id || 0),
    accountId: getCurrentAccountId(),
    checkInDate: checkInRaw + 'T00:00:00',
    checkOutDate: checkOutRaw + 'T00:00:00',
    status: 'Đã xác nhận giữ chỗ',
    totalRoomAmount: Number(priceValue || 0),
    notes: 'Tạo từ Booking AI cho ' + resolvedName
  };

  try {
    const response = await fetch(BOOKING_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(await extractApiError(response, 'Không thể lưu booking vào hệ thống.'));
    }

    await Promise.all([loadAndRenderConfirmedBookings(), fetchBookingInventory(), fetchInvoiceIndex()]);
  } catch (error) {
    showToast(error.message || 'Không thể lưu booking vào database.', 'error');
    return;
  }

  const aiGridContainer = document.getElementById('aiGridContainer');
  if (aiGridContainer) {
    aiGridContainer.style.display = 'none';
  }

  const modal = document.getElementById('bookingSuccessModal');
  const title = document.getElementById('successTitle');
  const msg = document.getElementById('successMessage');

  if (modal) {
    if (title) title.innerText = 'Đặt phòng thành công!';
    if (msg) msg.innerText = 'Phòng ' + roomName + ' giá ' + formatCurrency(priceValue) + ' đã được xác nhận và lưu vào hệ thống.';
    modal.style.display = 'flex';
  }
};

window.closeSuccessModal = function () {
  const modal = document.getElementById('bookingSuccessModal');
  if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', async function () {
  var checkInEl = document.getElementById('checkInDate');
  var checkOutEl = document.getElementById('checkOutDate');
  var today = new Date();
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var fmt = function(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  if (checkInEl && !checkInEl.value) checkInEl.value = fmt(today);
  if (checkOutEl && !checkOutEl.value) checkOutEl.value = fmt(tomorrow);

  try {
    await Promise.all([fetchLookupData(), fetchBookingInventory(), fetchInvoiceServices(), fetchInvoiceIndex()]);
    populateCustomerDatalist();
    populateRoomSelect();
  } catch (error) {
    showToast(error.message || 'Lỗi tải dữ liệu khách hàng/phòng.', 'error');
  }

  await Promise.all([loadAndRenderPendingBookings(), loadAndRenderConfirmedBookings()]);
  await initBookingRealtime();

  const debounced = window.AppCore && typeof window.AppCore.debounce === 'function'
    ? window.AppCore.debounce
    : function (fn) {
      let timer;
      return function () {
        const args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () {
          fn.apply(null, args);
        }, 350);
      };
    };

  const pendingSearchEl = document.getElementById('pendingBookingSearch');
  if (pendingSearchEl) {
    pendingSearchEl.addEventListener('input', debounced(async function (event) {
      pendingQueryState.q = String(event.target.value || '').trim();
      pendingQueryState.pageNumber = 1;
      await loadAndRenderPendingBookings();
    }, 350));
  }

  const pendingSortEl = document.getElementById('pendingBookingSort');
  if (pendingSortEl) {
    pendingSortEl.addEventListener('change', async function (event) {
      parseSortValue(event.target.value, pendingQueryState);
      pendingQueryState.pageNumber = 1;
      await loadAndRenderPendingBookings();
    });
  }

  const btnRefreshPending = document.getElementById('btnRefreshPending');
  if (btnRefreshPending) {
    btnRefreshPending.addEventListener('click', async function () {
      await loadAndRenderPendingBookings();
    });
  }

  const btnPrevPending = document.getElementById('btnPrevPending');
  if (btnPrevPending) {
    btnPrevPending.addEventListener('click', async function () {
      if (!pendingPagingState.hasPreviousPage) return;
      pendingQueryState.pageNumber -= 1;
      await loadAndRenderPendingBookings();
    });
  }

  const btnNextPending = document.getElementById('btnNextPending');
  if (btnNextPending) {
    btnNextPending.addEventListener('click', async function () {
      if (!pendingPagingState.hasNextPage) return;
      pendingQueryState.pageNumber += 1;
      await loadAndRenderPendingBookings();
    });
  }

  const confirmedSearchEl = document.getElementById('confirmedBookingSearch');
  if (confirmedSearchEl) {
    confirmedSearchEl.addEventListener('input', debounced(async function (event) {
      confirmedQueryState.q = String(event.target.value || '').trim();
      confirmedQueryState.pageNumber = 1;
      await loadAndRenderConfirmedBookings();
    }, 350));
  }

  const confirmedSortEl = document.getElementById('confirmedBookingSort');
  if (confirmedSortEl) {
    confirmedSortEl.addEventListener('change', async function (event) {
      parseSortValue(event.target.value, confirmedQueryState);
      confirmedQueryState.pageNumber = 1;
      await loadAndRenderConfirmedBookings();
    });
  }

  const btnRefreshConfirmed = document.getElementById('btnRefreshConfirmed');
  if (btnRefreshConfirmed) {
    btnRefreshConfirmed.addEventListener('click', async function () {
      await loadAndRenderConfirmedBookings();
    });
  }

  const btnPrevConfirmed = document.getElementById('btnPrevConfirmed');
  if (btnPrevConfirmed) {
    btnPrevConfirmed.addEventListener('click', async function () {
      if (!confirmedPagingState.hasPreviousPage) return;
      confirmedQueryState.pageNumber -= 1;
      await loadAndRenderConfirmedBookings();
    });
  }

  const btnNextConfirmed = document.getElementById('btnNextConfirmed');
  if (btnNextConfirmed) {
    btnNextConfirmed.addEventListener('click', async function () {
      if (!confirmedPagingState.hasNextPage) return;
      confirmedQueryState.pageNumber += 1;
      await loadAndRenderConfirmedBookings();
    });
  }

  const searchForm = document.getElementById('bookingSearchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var validation = window.AppCore && window.AppCore.Validation;
      if (validation && !validation.validateFields(searchForm, [
        {
          input: '#customerSearchInput',
          validate: function(value) {
            return validation.normalizeText(value) ? '' : 'Vui lòng nhập CCCD khách hàng.';
          }
        },
        {
          input: '#budgetLimit',
          validate: function(value) {
            if (!validation.normalizeText(value)) return '';
            return validation.isPositiveNumber(value) ? '' : 'Ngân sách phải lớn hơn 0.';
          }
        },
        {
          input: '#checkInDate',
          validate: function(value) {
            if (!value) return '';
            return validation.parseFlexibleDate(value) ? '' : 'Ngày nhận không hợp lệ.';
          }
        },
        {
          input: '#checkOutDate',
          validate: function(value) {
            if (!value) return '';
            var inDate = validation.parseFlexibleDate(document.getElementById('checkInDate').value);
            var outDate = validation.parseFlexibleDate(value);
            if (!outDate) return 'Ngày trả không hợp lệ.';
            if (inDate && outDate <= inDate) return 'Ngày trả phải sau ngày nhận.';
            return '';
          }
        }
      ])) {
        return;
      }
      const customerSearch = document.getElementById('customerSearchInput') ? document.getElementById('customerSearchInput').value : 'Seraphina Vance';
      const aiPrompt = document.getElementById('aiAdminPrompt') ? document.getElementById('aiAdminPrompt').value : '';
      const budgetValue = document.getElementById('budgetLimit') ? document.getElementById('budgetLimit').value : '';
      const roomPurpose = document.getElementById('roomPurpose') ? document.getElementById('roomPurpose').value : 'All';
      const btn = document.getElementById('btnSearchAI');

      if (btn) {
        btn.innerHTML = '<span class="material-symbols-outlined rotate" style="font-size: 18px;">sync</span> Đang phân tích...';
        btn.disabled = true;
      }
      const aiGridContainer = document.getElementById('aiGridContainer');
      if (aiGridContainer) {
        aiGridContainer.style.display = 'grid';
      }

      const roomPurposeElement = document.getElementById('roomPurpose');
      const guestCountElement = document.getElementById('guestCount');
      const checkInDate = document.getElementById('checkInDate') ? document.getElementById('checkInDate').value : '';
      const checkOutDate = document.getElementById('checkOutDate') ? document.getElementById('checkOutDate').value : '';
      const matchedCustomer = findCustomerFromInput(customerSearch);
      const historySummary = buildBookingHistorySummary(customerSearch);
      const promptTokens = String(aiPrompt || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(function (token) {
          return token.length >= 3;
        });
      const customerPreferenceTokens = String((matchedCustomer && matchedCustomer.aiPreferences) || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(function (token) {
          return token.length >= 3;
        });
      const stayNights = checkInDate && checkOutDate
        ? countNights(checkInDate, checkOutDate)
        : 0;
      if (checkInDate && checkOutDate && stayNights <= 0) {
        showToast('Ngày trả phải sau ngày nhận phòng.', 'error');
        if (btn) {
          btn.innerText = 'Tìm phòng AI';
          btn.disabled = false;
        }
        return;
      }
      const criteria = {
        budgetLimit: Number(budgetValue || 0),
        roomPurpose: roomPurpose,
        roomPurposeLabel: roomPurposeElement ? roomPurposeElement.options[roomPurposeElement.selectedIndex].text : '',
        guestLabel: guestCountElement ? guestCountElement.options[guestCountElement.selectedIndex].text : '',
        guestCount: parseGuestCountLabel(guestCountElement ? guestCountElement.value : ''),
        promptTokens: promptTokens,
        customerPreferenceTokens: customerPreferenceTokens,
        seed: (matchedCustomer && (matchedCustomer.identityCard || matchedCustomer.fullName)) || customerSearch,
        checkInRaw: checkInDate,
        checkOutRaw: checkOutDate,
        checkInLabel: checkInDate ? formatDateTime(checkInDate + 'T00:00:00') : '',
        checkOutLabel: checkOutDate ? formatDateTime(checkOutDate + 'T00:00:00') : '',
        stayNights: stayNights
      };
      const rankedOptions = buildRankedRoomOptions(criteria, 3);

      updateAIInsights(customerSearch, aiPrompt, { criteria: criteria, historySummary: historySummary });
      renderAILoading();

      fetchAiRecommendation({
        customerQuery: customerSearch,
        budgetLimit: Number(budgetValue || 0),
        roomPurpose: roomPurpose,
        aiPrompt: aiPrompt,
        bookingHistorySummary: historySummary.summaryText,
        checkInDate: checkInDate || null,
        checkOutDate: checkOutDate || null,
        guestCount: criteria.guestCount || null
      })
        .then(function (aiResult) {
          renderAIResults({
            customerName: aiResult.customerName || resolveCustomerInsight(customerSearch).displayName,
            criteria: criteria,
            bestOption: aiResult.bestOption,
            alternatives: (Array.isArray(aiResult.alternatives) && aiResult.alternatives.length > 0)
              ? aiResult.alternatives
              : rankedOptions.filter(function (option) {
                return option.name !== aiResult.bestOption.name;
              }).slice(0, 2)
          });
        })
        .catch(function (error) {
          const fallbackOption = buildAIMatchOption(criteria);
          renderAIResults({
            customerName: resolveCustomerInsight(customerSearch).displayName,
            criteria: criteria,
            bestOption: fallbackOption,
            alternatives: rankedOptions.slice(1, 3)
          });
          showToast(error.message || 'AI backend lỗi, đã dùng gợi ý dự phòng.', 'warning');
        })
        .finally(function () {
          if (btn) {
            btn.innerText = 'Tìm phòng AI';
            btn.disabled = false;
          }
        });
    });
  }

  const style = document.createElement('style');
  style.innerHTML = '\
    @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }\
    .rotate { animation: rotate 1s linear infinite; }';
  document.head.appendChild(style);

  const bookingInvoiceForm = document.getElementById('bookingInvoiceForm');
  if (bookingInvoiceForm) {
    bookingInvoiceForm.addEventListener('submit', saveBookingInvoice);
  }

  const bookingInvoiceLookup = document.getElementById('bookingInvoiceLookup');
  if (bookingInvoiceLookup) {
    bookingInvoiceLookup.addEventListener('keypress', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        window.handleBookingInvoiceLookup();
      }
    });
  }

  const bookingInvoiceServicesList = document.getElementById('bookingInvoiceServicesList');
  if (bookingInvoiceServicesList) {
    bookingInvoiceServicesList.addEventListener('change', function (event) {
      if (event.target && event.target.classList.contains('booking-invoice-service')) {
        calculateBookingInvoiceTotal();
      }
    });
  }
});
