const API_BASE = 'https://localhost:7082/api';
const INVOICES_API = API_BASE + '/Invoices';
const CUSTOMERS_API = API_BASE + '/Customers';
const BOOKINGS_API = API_BASE + '/Bookings';
const SERVICES_API = API_BASE + '/Services';

let invoicesData = [];

let currentEditId = null;
let invoiceToDelete = null;
let checkoutBasePrice = 0;
let customersData = [];
let bookingsData = [];
let servicesCatalog = [];

function canEditInvoices() {
  return Boolean(localStorage.getItem('token'));
}

function canDeleteInvoices() {
  return Boolean(window.AppCore && typeof window.AppCore.isAdminRole === 'function'
    && window.AppCore.isAdminRole(window.AppCore.getAuthContext().role));
}

function applyInvoiceRoleAccess() {
  const canEdit = canEditInvoices();
  const canDelete = canDeleteInvoices();
  const addBtn = document.getElementById('btnAddInvoice');
  const submitBtn = document.getElementById('invoiceSubmitButton');
  const deleteBtn = document.getElementById('invoiceDeleteButton');

  if (addBtn) addBtn.style.display = canEdit ? '' : 'none';
  if (submitBtn) submitBtn.style.display = canEdit ? '' : 'none';
  if (deleteBtn) deleteBtn.style.display = canDelete ? '' : 'none';
}

const fallbackInvoices = [
  { id: 'INV-8821', customer: 'Trần Hoàn', cccd: '001122334411', room: 'Suite 402', date: '12/06/2024', amount: 12500000, status: 'Đã thanh toán', services: [], bookingId: null, customerId: null, sourceInvoiceId: null },
  { id: 'INV-8822', customer: 'An Lê', cccd: '001122334422', room: 'Deluxe 205', date: '14/06/2024', amount: 4200000, status: 'Chưa thanh toán', services: [], bookingId: null, customerId: null, sourceInvoiceId: null },
  { id: 'INV-8823', customer: 'Minh Đào', cccd: '001122334433', room: 'Standard 101', date: '08/06/2024', amount: 8900000, status: 'Quá hạn', services: [], bookingId: null, customerId: null, sourceInvoiceId: null }
];

function showToast(message, variant) {
  if (window.AppCore && typeof window.AppCore.toast === 'function') {
    window.AppCore.toast(message, variant);
    return;
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

function toUiStatus(paymentStatus) {
  if (!paymentStatus) return 'Chưa thanh toán';
  const s = String(paymentStatus).trim().toLowerCase();
  if (s === 'đã thanh toán' || s === 'hoàn tất thanh toán' || s === 'paid') return 'Đã thanh toán';
  if (s === 'quá hạn' || s === 'overdue') return 'Quá hạn';
  return 'Chưa thanh toán';
}

function toApiPaymentStatus(uiStatus) {
  if (uiStatus === 'Đã thanh toán') return 'Đã thanh toán';
  if (uiStatus === 'Quá hạn') return 'Quá hạn';
  return 'Chưa thanh toán';
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
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

function safeGetArrayPayload(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return [];
}

async function fetchInvoicesRaw() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(INVOICES_API, { method: 'GET', headers: headers });
  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải danh sách hóa đơn'));
  }
  return await response.json();
}

async function fetchCustomersRaw() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(CUSTOMERS_API + '?pageNumber=1&pageSize=100&sortBy=updatedAt&sortDir=desc', {
    method: 'GET',
    headers: headers
  });
  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải danh sách khách hàng'));
  }
  return await response.json();
}

async function fetchBookingsRaw() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(BOOKINGS_API + '?pageNumber=1&pageSize=100&sortBy=createdAt&sortDir=desc', {
    method: 'GET',
    headers: headers
  });
  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải danh sách đặt phòng'));
  }
  return await response.json();
}

async function fetchServicesRaw() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const response = await fetch(SERVICES_API + '?pageNumber=1&pageSize=100&sortBy=updatedAt&sortDir=desc', {
    method: 'GET',
    headers: headers
  });
  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải danh sách dịch vụ'));
  }
  return await response.json();
}

function normalizeService(raw) {
  return {
    id: Number(raw.id),
    name: raw.serviceName || 'Dịch vụ',
    price: Number(raw.price || 0),
    status: raw.status || 'Hoạt động'
  };
}

function normalizeCustomer(raw) {
  return {
    id: Number(raw.id || 0),
    name: raw.fullName || '',
    email: raw.email || '',
    phone: raw.phoneNumber || '',
    cccd: raw.identityCard || '',
    usage: 0
  };
}

function normalizeInvoice(raw, customersById, bookingsById) {
  const customer = customersById.get(raw.customerId) || null;
  const booking = bookingsById.get(raw.bookingId) || null;
  return {
    id: raw.invoiceCode || ('INV-' + raw.id),
    sourceInvoiceId: raw.id,
    customerId: raw.customerId,
    bookingId: raw.bookingId,
    customer: customer ? customer.name : ('Khách #' + raw.customerId),
    cccd: customer ? customer.cccd : '',
    room: booking ? (booking.roomName || ('Phòng #' + booking.roomId)) : ('Phòng #' + raw.bookingId),
    date: formatDate(raw.issuedAt),
    amount: Number(raw.totalAmount || 0),
    status: toUiStatus(raw.paymentStatus),
    services: []
  };
}

async function loadApiData() {
  const [invoicesRaw, customersRaw, bookingsRaw, servicesRaw] = await Promise.all([
    fetchInvoicesRaw(),
    fetchCustomersRaw(),
    fetchBookingsRaw(),
    fetchServicesRaw()
  ]);

  customersData = safeGetArrayPayload(customersRaw).map(normalizeCustomer);
  bookingsData = safeGetArrayPayload(bookingsRaw);
  servicesCatalog = safeGetArrayPayload(servicesRaw)
    .map(normalizeService)
    .filter(function (service) {
      return service.status !== 'Tạm ngưng';
    });

  const customersById = new Map(customersData.map(function (c) { return [c.id, c]; }));
  const bookingsById = new Map(bookingsData.map(function (b) { return [b.id, b]; }));
  invoicesData = safeGetArrayPayload(invoicesRaw).map(function (inv) {
    return normalizeInvoice(inv, customersById, bookingsById);
  });
}

function findBookingForInvoice(customerId, roomLabel) {
  const roomNeedle = String(roomLabel || '').trim().toLowerCase();
  const candidates = bookingsData.filter(function (b) {
    if (b.customerId !== customerId) return false;
    if (!roomNeedle) return true;
    return String(b.roomName || '').toLowerCase().includes(roomNeedle);
  });

  if (candidates.length > 0) {
    return candidates[0];
  }

  return bookingsData.find(function (b) { return b.customerId === customerId; }) || null;
}

function findCustomerByCccd(cccd) {
  const needle = String(cccd || '').trim().toLowerCase();
  if (!needle) return null;
  return customersData.find(function (customer) {
    return String(customer.cccd || '').trim().toLowerCase() === needle;
  }) || null;
}

function findCustomerById(customerId) {
  return customersData.find(function (customer) {
    return Number(customer.id || 0) === Number(customerId || 0);
  }) || null;
}

function findBookingByIntent(intent) {
  if (!intent) return null;

  if (intent.bookingId) {
    const matchedById = bookingsData.find(function (booking) {
      return Number(booking.id || 0) === Number(intent.bookingId || 0);
    });
    if (matchedById) return matchedById;
  }

  if (intent.bookingCode) {
    const matchedByCode = bookingsData.find(function (booking) {
      return String(booking.bookingCode || '').trim().toLowerCase() === String(intent.bookingCode || '').trim().toLowerCase();
    });
    if (matchedByCode) return matchedByCode;
  }

  if (intent.customerId || intent.roomName) {
    return findBookingForInvoice(Number(intent.customerId || 0), intent.roomName || '');
  }

  return null;
}

function buildInvoicePayload(formData, customerId, bookingId) {
  const servicesTotal = formData.services.reduce(function (sum, serviceName) {
    const service = servicesCatalog.find(function (item) {
      return item.name === serviceName;
    });
    return sum + Number((service && service.price) || 0);
  }, 0);

  const subtotalRoom = Math.max(0, Number(formData.amount) - servicesTotal);
  return {
    invoiceCode: formData.id,
    bookingId: bookingId,
    customerId: customerId,
    accountId: null,
    subtotalRoom: subtotalRoom,
    subtotalServices: servicesTotal,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: Number(formData.amount),
    paymentMethod: 'Tiền mặt',
    paymentStatus: toApiPaymentStatus(formData.status),
    issuedAt: parseUiDateToIso(formData.date)
  };
}

function getStatusStyle(status) {
  switch (status) {
    case 'Đã thanh toán': return { bg: '#e7f3ef', color: '#0d7350' };
    case 'Chưa thanh toán': return { bg: '#fff9e6', color: '#ffa500' };
    case 'Quá hạn': return { bg: '#fee2e2', color: '#ef4444' };
    default: return { bg: '#f6f5f4', color: '#615d59' };
  }
}

function getAvatarColor(name) {
  const colors = [
    { bg: '#f2f9ff', text: '#0075de' },
    { bg: '#f6f3ff', text: '#7b61ff' },
    { bg: '#fff5f2', text: '#ff5c00' },
    { bg: '#e7f3ef', text: '#0d7350' },
    { bg: '#fffdf0', text: '#d58d00' }
  ];
  const index = name.length % colors.length;
  return colors[index];
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function getSelectedServiceNames() {
  return Array.from(document.querySelectorAll('.service-checkbox:checked')).map(function (cb) {
    return cb.value;
  });
}

function renderServiceOptions(selectedServices) {
  const container = document.getElementById('invoiceServicesList');
  if (!container) return;

  const selected = Array.isArray(selectedServices) ? selectedServices : [];

  if (!servicesCatalog.length) {
    container.innerHTML = '<span style="font-size: 13px; color: var(--notion-gray-500);">Chưa có dịch vụ khả dụng từ hệ thống.</span>';
    return;
  }

  container.innerHTML = servicesCatalog.map(function (service) {
    const checked = selected.includes(service.name) ? ' checked' : '';
    return '<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">'
      + '<input type="checkbox" name="invServices" value="' + service.name + '" data-price="' + service.price + '" class="service-checkbox"' + checked + '>'
      + service.name + ' (' + formatCurrency(service.price) + ')'
      + '</label>';
  }).join('');
}

function updateStats(filteredData = null) {
  const data = filteredData || invoicesData;
  const total = data.length;
  const paid = data.filter(i => i.status === 'Đã thanh toán').length;
  const pending = data.filter(i => i.status === 'Chưa thanh toán').length;
  
  const totalEl = document.getElementById('stat-total');
  const paidEl = document.getElementById('stat-paid');
  const pendingEl = document.getElementById('stat-pending');
  const totalInvoicesEl = document.getElementById('totalInvoices');
  
  if(totalEl) totalEl.innerText = total;
  if(paidEl) paidEl.innerText = paid;
  if(pendingEl) pendingEl.innerText = pending;
  if(totalInvoicesEl) totalInvoicesEl.innerText = total;
}

function renderInvoices(filters = {}) {
  const tbody = document.getElementById('invoiceTableBody');
  if (!tbody) return;
  const canEdit = canEditInvoices();
  const canDelete = canDeleteInvoices();
  
  let filteredData = invoicesData;
  if (filters.search) {
      const q = filters.search.toLowerCase();
      filteredData = invoicesData.filter(inv => 
          inv.id.toLowerCase().includes(q) || 
          inv.customer.toLowerCase().includes(q) || 
          inv.room.toLowerCase().includes(q)
      );
  }
  
  tbody.innerHTML = filteredData.map(inv => {
    const statusStyle = getStatusStyle(inv.status);
    const avatarColor = getAvatarColor(inv.customer);
    const initials = getInitials(inv.customer);
    
    return `
      <tr>
        <td style="padding-left: 24px;"><span class="invoice-id-badge">${inv.id}</span></td>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div>
              <p style="font-weight:600; font-size: 14px;">${inv.customer}</p>
            </div>
          </div>
        </td>
        <td><span >${inv.room}</span></td>
        <td style="font-size: 13px; color: var(--notion-gray-500);">${inv.date}</td>
        <td style="font-weight:700; font-size: 14px;">${formatCurrency(inv.amount)}</td>
        <td style="text-align:center;"><span class="notion-pill" style="background:${statusStyle.bg}; color:${statusStyle.color};">${inv.status}</span></td>
        <td style="text-align:right; padding-right: 24px;">
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center; color: var(--notion-blue);" onclick="openPaymentModal('${inv.id}')" title="Chi tiết & QR">
              <span class="material-symbols-outlined" style="font-size:18px;">qr_code_2</span>
            </button>
            ${canEdit ? `<button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center;" onclick="openInvoiceModal('${inv.id}')">
              <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
            </button>` : ''}
            ${canDelete ? `<button class="btn-notion-sec" style="padding: 4px; min-width: 32px; justify-content: center; color: #ef4444;" onclick="confirmDeleteInvoice('${inv.id}')">
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  if(filteredData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--notion-gray-500);">Không có kết quả hóa đơn nào phù hợp.</td></tr>`;
  }
  
  updateStats(filteredData);
  applyInvoiceRoleAccess();
}

function openInvoiceModal(id = null) {
  if (!canEditInvoices()) return;

  const modal = document.getElementById('invoiceModal');
  const title = document.getElementById('invoiceModalTitle');
  const form = document.getElementById('invoiceForm');
  
  if (id) {
    currentEditId = id;
    title.innerText = 'Chỉnh sửa hóa đơn';
    const inv = invoicesData.find(i => i.id === id);
    if (inv) {
      document.getElementById('invCustomer').value = inv.customer;
      document.getElementById('invCccd').value = inv.cccd;
      document.getElementById('invRoom').value = inv.room;
      document.getElementById('invDate').value = inv.date;
      document.getElementById('invAmount').value = inv.amount;
      document.getElementById('invStatus').value = inv.status;
      
      checkoutBasePrice = inv.amount;
      renderServiceOptions(inv.services || []);
      document.querySelectorAll('.service-checkbox').forEach(cb => {
          if (inv.services && inv.services.includes(cb.value)) {
              cb.checked = true;
              checkoutBasePrice -= parseFloat(cb.dataset.price || 0);
          } else {
              cb.checked = false;
          }
      });
    }
  } else {
    currentEditId = null;
    title.innerText = 'Tạo hóa đơn mới';
    form.reset();
    document.getElementById('invStatus').value = 'Chưa thanh toán';
    renderServiceOptions([]);
    document.querySelectorAll('.service-checkbox').forEach(cb => cb.checked = false);
    checkoutBasePrice = 0;
    
    const newIdNum = invoicesData.length > 0 ? Math.max(...invoicesData.map(function (i) {
      const n = parseInt(String(i.id).split('-')[1], 10);
      return Number.isNaN(n) ? 0 : n;
    })) + 1 : 8821;
    document.getElementById('invDate').value = new Date().toISOString().split('T')[0].split('-').reverse().join('/');
    document.getElementById('invAmount').value = '';
  }
  
  modal.style.display = 'flex';

  
  const cccdList = document.getElementById('cccdList');
  if (cccdList) {
    cccdList.innerHTML = customersData.map(c => `<option value="${c.cccd}">${c.name}</option>`).join('');
  }
}

function fillInvoiceFormFromContext(customer, booking, options) {
  const context = options || {};
  if (!customer) return false;

  document.getElementById('invCustomer').value = customer.name;
  document.getElementById('invCccd').value = customer.cccd;
  document.getElementById('invRoom').value = (booking && booking.roomName) || context.roomName || '';

  const amountValue = booking
    ? Number(booking.totalRoomAmount || 0)
    : Number(context.totalRoomAmount || customer.usage || 0);

  document.getElementById('invAmount').value = amountValue;
  checkoutBasePrice = amountValue;
  renderServiceOptions([]);

  return true;
}

function handleLookup(options) {
  const context = options || {};
  const searchInput = document.getElementById('searchPhone');
  const cccd = String(context.cccd || (searchInput ? searchInput.value : '')).trim();
  const customer = findCustomerByCccd(cccd);

  if (customer) {
    if (searchInput) {
      searchInput.value = customer.cccd;
    }
    const booking = context.booking || findBookingByIntent({
      bookingId: context.bookingId,
      bookingCode: context.bookingCode,
      customerId: customer.id,
      roomName: context.roomName
    }) || findBookingForInvoice(customer.id, context.roomName || '');

    fillInvoiceFormFromContext(customer, booking, context);
    showToast('Đã tự động lấy thông tin từ hệ thống', 'success');
  } else {
    showToast('Không tìm thấy khách hàng với CCCD này', 'error');
  }
}

function getPendingInvoiceIntent() {
  const raw = localStorage.getItem('pending_invoice_booking');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    localStorage.removeItem('pending_invoice_booking');
    return null;
  }
}

function clearPendingInvoiceIntent() {
  localStorage.removeItem('pending_invoice_booking');
}

function tryAutoOpenInvoiceFromBooking() {
  const url = new URL(window.location.href);
  const shouldAutoCreate = url.searchParams.get('autocreate') === '1';
  const intent = getPendingInvoiceIntent();
  if (!shouldAutoCreate || !intent) return;

  openInvoiceModal();

  const searchInput = document.getElementById('searchPhone');
  if (searchInput && intent.cccd) {
    searchInput.value = intent.cccd;
  }

  const customer = (intent.cccd && findCustomerByCccd(intent.cccd))
    || (intent.customerId && findCustomerById(intent.customerId))
    || null;
  const booking = findBookingByIntent(intent);

  if (customer) {
    fillInvoiceFormFromContext(customer, booking, intent);
    showToast('Đã mở form hóa đơn từ booking đã xác nhận.', 'success');
  } else if (intent.cccd) {
    handleLookup(intent);
  } else {
    showToast('Không tìm thấy CCCD khách để tự điền hóa đơn.', 'warning');
  }

  clearPendingInvoiceIntent();
  url.searchParams.delete('autocreate');
  window.history.replaceState({}, document.title, url.pathname + (url.search ? '?' + url.searchParams.toString() : ''));
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').style.display = 'none';
}

function calculateTotal() {
  let initialAmountInput = document.getElementById('invAmount');
  if (checkoutBasePrice === 0) checkoutBasePrice = parseFloat(initialAmountInput.value) || 0;
  
  let total = checkoutBasePrice;
  document.querySelectorAll('.service-checkbox:checked').forEach(cb => {
      total += parseFloat(cb.dataset.price || 0);
  });
  initialAmountInput.value = total;
}

async function saveInvoice(e) {
  e.preventDefault();
  if (!canEditInvoices()) {
    showToast('Bạn không có quyền tạo hoặc sửa hóa đơn.', 'error');
    return;
  }

  const validation = window.AppCore && window.AppCore.Validation;
  if (validation && !validation.validateFields(e.target, [
    {
      input: '#invCustomer',
      validate: function(value) {
        return validation.normalizeText(value).length >= 2 ? '' : 'Tên khách hàng phải có ít nhất 2 ký tự.';
      }
    },
    {
      input: '#invCccd',
      validate: function(value) {
        return validation.isValidIdentityCard(value) ? '' : 'CCCD phải gồm 9 hoặc 12 chữ số.';
      }
    },
    {
      input: '#invRoom',
      validate: function(value) {
        return validation.normalizeText(value) ? '' : 'Vui lòng nhập phòng lưu trú.';
      }
    },
    {
      input: '#invDate',
      validate: function(value) {
        return validation.parseFlexibleDate(value) ? '' : 'Ngày lập hóa đơn không hợp lệ.';
      }
    },
    {
      input: '#invAmount',
      validate: function(value) {
        return validation.isPositiveNumber(value) ? '' : 'Tổng tiền phải lớn hơn 0.';
      }
    },
    {
      input: '#invStatus',
      validate: function(value) {
        return validation.normalizeText(value) ? '' : 'Vui lòng chọn trạng thái.';
      }
    }
  ])) {
    return;
  }

  const customer = document.getElementById('invCustomer').value.trim();
  const cccd = document.getElementById('invCccd').value.trim();
  const room = document.getElementById('invRoom').value.trim();
  const date = document.getElementById('invDate').value.trim();
  const amount = parseFloat(document.getElementById('invAmount').value);
  const status = document.getElementById('invStatus').value;
  const services = getSelectedServiceNames();
  const idFromEdit = currentEditId;

  const normalizedId = idFromEdit || ('INV-' + (invoicesData.length > 0 ? Math.max(...invoicesData.map(function (i) {
    const n = parseInt(String(i.id).split('-')[1], 10);
    return Number.isNaN(n) ? 0 : n;
  })) + 1 : 8821));

  const matchedCustomer = customersData.find(function (c) {
    return (cccd && c.cccd === cccd) || String(c.name).toLowerCase() === String(customer).toLowerCase();
  });

  if (!matchedCustomer) {
    showToast('Không tìm thấy khách hàng trong hệ thống. Vui lòng nhập CCCD đúng.', 'error');
    return;
  }

  const matchedBooking = findBookingForInvoice(matchedCustomer.id, room);
  if (!matchedBooking) {
    showToast('Không tìm thấy đặt phòng tương ứng để lập hóa đơn.', 'error');
    return;
  }

  const formData = {
    id: normalizedId,
    customer: customer,
    cccd: cccd,
    room: room,
    date: date,
    amount: amount,
    status: status,
    services: services
  };

  const payload = buildInvoicePayload(formData, matchedCustomer.id, matchedBooking.id);
  
  try {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    if (currentEditId) {
      const current = invoicesData.find(function (i) { return i.id === currentEditId; });
      if (!current || !current.sourceInvoiceId) {
        showToast('Không tìm thấy hóa đơn gốc để cập nhật.', 'error');
        return;
      }

      const updateResponse = await fetch(INVOICES_API + '/' + current.sourceInvoiceId, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
          id: current.sourceInvoiceId,
          invoiceCode: payload.invoiceCode,
          bookingId: payload.bookingId,
          customerId: payload.customerId,
          accountId: payload.accountId,
          subtotalRoom: payload.subtotalRoom,
          subtotalServices: payload.subtotalServices,
          taxAmount: payload.taxAmount,
          discountAmount: payload.discountAmount,
          totalAmount: payload.totalAmount,
          paymentMethod: payload.paymentMethod,
          paymentStatus: payload.paymentStatus,
          issuedAt: payload.issuedAt
        })
      });

      if (!updateResponse.ok) {
        throw new Error(await extractApiError(updateResponse, 'Không thể cập nhật hóa đơn'));
      }
    } else {
      const createResponse = await fetch(INVOICES_API, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!createResponse.ok) {
        throw new Error(await extractApiError(createResponse, 'Không thể tạo hóa đơn'));
      }
    }

    await loadApiData();
    closeInvoiceModal();
    renderInvoices();
    showToast('Lưu hóa đơn thành công', 'success');
  } catch (error) {
    showToast(error.message || 'Không thể lưu hóa đơn', 'error');
  }
}

function closePaymentModal() {
  const modal = document.getElementById('paymentDetailsModal');
  if (modal) modal.style.display = 'none';
}

function openPaymentModal(id) {
  const inv = invoicesData.find(i => i.id === id);
  if (!inv) return;

  const content = document.getElementById('paymentDetailsContent');
  const qrImg = document.getElementById('qrImage');
  const modal = document.getElementById('paymentDetailsModal');

  
  content.innerHTML = `
    <div style="background: var(--notion-warm-white); border-radius: 8px; padding: 20px; border: var(--notion-whisper);">
       <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: var(--notion-gray-500); font-size: 13px;">Mã hóa đơn:</span>
          <span style="font-weight: 700; color: var(--notion-blue); font-family: var(--f-mono);">${inv.id}</span>
       </div>
       <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: var(--notion-gray-500); font-size: 13px;">Khách hàng:</span>
          <span style="font-weight: 600;">${inv.customer}</span>
       </div>
       <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: var(--notion-gray-500); font-size: 13px;">Dịch vụ/Phòng:</span>
          <span style="font-weight: 500;">${inv.room}</span>
       </div>
       ${inv.services && inv.services.length > 0 ? `
       <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: var(--notion-gray-500); font-size: 13px;">Dịch vụ dùng thêm:</span>
          <span style="font-weight: 500; font-size: 13px; text-align: right;">${inv.services.join('<br>')}</span>
       </div>` : ''}
       <div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--notion-whisper);">
          <span style="font-weight: 700; font-size: 15px;">Tổng cộng:</span>
          <span style="font-weight: 800; font-size: 18px; color: var(--notion-black);">${formatCurrency(inv.amount)}</span>
       </div>
    </div>
  `;

  
  const bankSettings = JSON.parse(localStorage.getItem('luxe_bank_settings') || '{"bankId":"970436","accountNo":"123456789","accountName":"LUXE CONCIERGE"}');
  
  const bankId = bankSettings.bankId || '970436';
  const accountNo = bankSettings.accountNo || '123456789';
  const accountName = encodeURIComponent(bankSettings.accountName || 'LUXE CONCIERGE');
  const amount = inv.amount;
  const info = encodeURIComponent(`THANH TOAN ${inv.id}`);
  
  
  modal.style.display = 'flex';
  
  
  qrImg.src = ''; 
  qrImg.style.opacity = '0.5';

  
  
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${amount}&addInfo=${info}&accountName=${accountName}`;
  
  
  qrImg.src = qrUrl;

  qrImg.onload = function() {
    this.style.opacity = '1';
  };

  
  qrImg.onerror = function() {
    this.style.opacity = '1';
    this.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('STK: ' + accountNo + ' - NH: ' + bankId + ' - Tien: ' + amount)}`;

  };
}

function confirmDeleteInvoice(id) {
  if (!canDeleteInvoices()) {
    showToast('Bạn không có quyền xóa hóa đơn.', 'error');
    return;
  }

  invoiceToDelete = id;
  document.getElementById('deleteConfirmModal').style.display = 'flex';
}

function closeDeleteModal() {
  invoiceToDelete = null;
  document.getElementById('deleteConfirmModal').style.display = 'none';
}

function deleteInvoice() {
  if (!canDeleteInvoices()) {
    showToast('Bạn không có quyền xóa hóa đơn.', 'error');
    return;
  }

  if (invoiceToDelete) {
    const target = invoicesData.find(function (i) { return i.id === invoiceToDelete; });
    if (!target || !target.sourceInvoiceId) {
      showToast('Không tìm thấy hóa đơn trong hệ thống', 'error');
      return;
    }

    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    fetch(INVOICES_API + '/' + target.sourceInvoiceId, { method: 'DELETE', headers: headers })
      .then(async function (response) {
        if (!response.ok) {
          throw new Error(await extractApiError(response, 'Không thể xóa hóa đơn'));
        }
        await loadApiData();
        closeDeleteModal();
        renderInvoices();
        showToast('Đã xóa hóa đơn', 'success');
      })
      .catch(function (error) {
        showToast(error.message || 'Không thể xóa hóa đơn', 'error');
      });
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  applyInvoiceRoleAccess();
  try {
    await loadApiData();
  } catch (error) {
    invoicesData = fallbackInvoices.slice();
    customersData = [];
    bookingsData = [];
    servicesCatalog = [];
    showToast(error.message || 'Không thể kết nối API. Đang dùng dữ liệu mẫu.', 'error');
  }

  renderInvoices();
  renderServiceOptions([]);
  tryAutoOpenInvoiceFromBooking();
  
  const addBtn = document.getElementById('btnAddInvoice');
  if(addBtn) addBtn.addEventListener('click', () => openInvoiceModal());
  
  const invoiceForm = document.getElementById('invoiceForm');
  if(invoiceForm) invoiceForm.addEventListener('submit', saveInvoice);

  const searchInvoices = document.getElementById('searchInvoices');
  if(searchInvoices) {
      searchInvoices.addEventListener('input', (e) => {
          renderInvoices({ search: e.target.value });
      });
  }

  const searchPhone = document.getElementById('searchPhone');
  if(searchPhone) {
    searchPhone.addEventListener('keypress', (e) => {
      if(e.key === 'Enter') {
        e.preventDefault();
        handleLookup();
      }
    });
  }

  const servicesList = document.getElementById('invoiceServicesList');
  if (servicesList) {
    servicesList.addEventListener('change', function (event) {
      if (event.target && event.target.classList.contains('service-checkbox')) {
        calculateTotal();
      }
    });
  }
  
  const amountInput = document.getElementById('invAmount');
  if (amountInput) {
      amountInput.addEventListener('input', (e) => {
          
          const hasChecked = Array.from(document.querySelectorAll('.service-checkbox')).some(function (cb) { return cb.checked; });
          if (!hasChecked) {
              checkoutBasePrice = parseFloat(e.target.value) || 0;
          }
      });
  }
});
