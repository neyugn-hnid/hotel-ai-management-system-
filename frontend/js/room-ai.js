const API_BASE_URL = 'https://localhost:7082';
const ROOMS_API_URL = API_BASE_URL + '/api/Rooms';
const BOOKING_AI_API_URL = API_BASE_URL + '/api/Bookings/ai/recommend';

let roomsData = [];
let currentSearchContext = {
  checkIn: '',
  checkOut: '',
  budget: '',
  roomType: 'All',
  prompt: '',
  guestCount: 2
};

const fallbackImages = [
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',
  'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80',
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
  'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1e52509def?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'
];

let currentPage = 1;
const itemsPerPage = 9;

function showToast(message, variant) {
  if (window.AppCore && typeof window.AppCore.toast === 'function') {
    window.AppCore.toast(message, variant);
    return;
  }
  console.warn(message);
}

function getPurposeFromRoomType(roomType) {
  switch (String(roomType || '').toLowerCase()) {
    case 'standard':
      return 'business';
    case 'deluxe':
      return 'family';
    case 'suite':
      return 'honeymoon';
    default:
      return 'all';
  }
}

function getGuestCountFromRoomType(roomType) {
  switch (String(roomType || '').toLowerCase()) {
    case 'deluxe':
      return 4;
    case 'standard':
      return 1;
    case 'suite':
      return 2;
    default:
      return 2;
  }
}

function pickFallbackImage(seed) {
  const source = String(seed || 'room');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % fallbackImages.length;
  return fallbackImages[idx];
}

function normalizeRoom(raw) {
  const images = Array.isArray(raw.images) ? raw.images : [];
  const firstImage = images.length > 0 ? images[0] : null;
  const imageUrl = (firstImage && (firstImage.imageUrl || firstImage.url)) || raw.imageUrl || raw.img || pickFallbackImage(raw.cardName || raw.name || raw.id);

  return {
    id: Number(raw.id || 0),
    name: raw.cardName || raw.name || 'Phòng',
    type: raw.roomType || 'Standard',
    price: Number(raw.pricePerNight || raw.price || 0),
    description: raw.description || 'Không có mô tả.',
    status: raw.status || '',
    img: imageUrl
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

async function fetchRooms() {
  const params = new URLSearchParams({
    sortBy: 'name',
    sortDir: 'asc',
    pageNumber: '1',
    pageSize: '100'
  });

  const response = await fetch(ROOMS_API_URL + '?' + params.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể tải danh sách phòng.'));
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
  roomsData = items.map(normalizeRoom);
}

function roomDetailUrl(roomId) {
  const params = new URLSearchParams();
  params.set('id', String(roomId));
  if (currentSearchContext.checkIn) params.set('checkIn', currentSearchContext.checkIn);
  if (currentSearchContext.checkOut) params.set('checkOut', currentSearchContext.checkOut);
  if (currentSearchContext.budget) params.set('budget', String(currentSearchContext.budget));
  if (currentSearchContext.roomType) params.set('roomType', currentSearchContext.roomType);
  if (currentSearchContext.guestCount) params.set('guestCount', String(currentSearchContext.guestCount));
  return 'room-detail.html?' + params.toString();
}

function renderAllRooms(page = 1) {
  if (roomsData.length === 0) {
    document.getElementById('allRoomsGrid').innerHTML = '<p style="color:#64748b; grid-column: 1/-1; text-align:center; padding: 40px 0;">Chưa có dữ liệu phòng để hiển thị.</p>';
    document.getElementById('paginationContainer').innerHTML = '';
    return;
  }

  currentPage = page;
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedRooms = roomsData.slice(start, end);

  document.getElementById('allRoomsGrid').innerHTML = paginatedRooms.map((room, i) => `
    <div class="room-card-pub hover-lift" onclick="window.location.href='${roomDetailUrl(room.id)}'">
      <div class="room-card-pub__img-wrap">
        <img class="room-card-pub__img" src="${room.img}" alt="${room.name}"/>
        <div class="room-card-pub__badge">${room.type}</div>
      </div>
      <div class="room-card-pub__body">
        <h3 style="font-family:var(--font-serif);font-size:1.5rem;font-weight:500;margin-bottom:.5rem;color:#0f172a;">${room.name}</h3>
        <p style="color:#64748b;font-size:.875rem;margin-bottom:1.25rem;line-height:1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight:300;">${room.description}</p>
        <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; font-weight:700; color:var(--color-gold); margin-bottom: 2rem;">Từ ${room.price.toLocaleString('vi-VN')}₫ / đêm</div>
        <button class="room-card-pub__footer">KHÁM PHÁ</button>
      </div>
    </div>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(roomsData.length / itemsPerPage);
  let html = '';
  
  if (totalPages <= 1) {
    document.getElementById('paginationContainer').innerHTML = '';
    return;
  }

  html += `<button class="pagination-btn" onclick="renderAllRooms(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><span class="material-symbols-outlined">chevron_left</span></button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pagination-btn ${currentPage === i ? 'active' : ''}" onclick="renderAllRooms(${i})">${i}</button>`;
  }

  html += `<button class="pagination-btn" onclick="renderAllRooms(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><span class="material-symbols-outlined">chevron_right</span></button>`;

  document.getElementById('paginationContainer').innerHTML = html;
}

function localRecommendFallback(input) {
  const budget = input.budget > 0 ? input.budget : Number.MAX_SAFE_INTEGER;
  const type = input.type;
  const prompt = String(input.prompt || '').toLowerCase();

  const recommendations = roomsData.map(room => {
    let score = 0;
    const reasons = [];

    if (room.price <= budget) {
      score += 30;
      reasons.push('Nằm trong khoảng ngân sách lý tưởng của bạn');
    } else if (room.price <= budget * 1.2) {
      score += 10;
    }

    if (type === 'All' || String(room.type || '').toLowerCase() === type.toLowerCase() || type === 'Suite') {
      score += 20;
      reasons.push('Hoàn toàn phù hợp với mục đích chuyến đi');
    }

    const desc = String(room.description || '').toLowerCase();
    if (prompt) {
      if ((prompt.includes('biển') || prompt.includes('ocean') || prompt.includes('sea')) && (desc.includes('biển') || desc.includes('ocean'))) {
        score += 40;
        reasons.push('Đáp ứng tuyệt đối yêu cầu về tầm nhìn hướng biển');
      }
      if ((prompt.includes('bồn tắm') || prompt.includes('bath')) && (desc.includes('bồn tắm') || room.type === 'Suite' || room.type === 'Deluxe')) {
        score += 20;
        reasons.push('Được trang bị bồn tắm ngâm mình thư giãn ngắm cảnh');
      }
      if ((prompt.includes('gia đình') || prompt.includes('family')) && (room.type === 'Suite' || room.type === 'Penthouse' || room.name.includes('Family'))) {
        score += 30;
        reasons.push('Không gian siêu rộng, lý tưởng cho sinh hoạt gia đình');
      }
      if ((prompt.includes('lãng mạn') || prompt.includes('trăng mật')) && (room.type === 'Suite' || room.type === 'Deluxe' || room.name.includes('Penthouse'))) {
        score += 25;
        reasons.push('Không gian hoàn hảo cho khoảnh khắc lãng mạn lứa đôi');
      }
      if (score < 40) {
        score += 15;
        reasons.push('AI Concierge đã ghi nhận và tối ưu thêm các yêu cầu đặc biệt của bạn');
      }
    }

    return { ...room, score, reasons, engine: 'fallback' };
  });

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 3);
}

async function fetchAiRecommendations(input) {
  const response = await fetch(BOOKING_AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customerQuery: input.customerQuery,
      budgetLimit: input.budget > 0 ? input.budget : null,
      roomPurpose: input.roomPurpose,
      aiPrompt: input.prompt,
      checkInDate: input.checkInDate ? input.checkInDate + 'T00:00:00' : null,
      checkOutDate: input.checkOutDate ? input.checkOutDate + 'T00:00:00' : null,
      guestCount: input.guestCount || 2
    })
  });

  if (!response.ok) {
    throw new Error(await extractApiError(response, 'Không thể lấy gợi ý AI từ backend.'));
  }

  const data = await response.json();
  const topRooms = Array.isArray(data.topRooms) ? data.topRooms : [];
  const recommendation = data.recommendation || null;
  const engine = data.engine || 'rule';

  const normalized = topRooms.map(function (item) {
    const matchedRoom = roomsData.find(function (room) {
      return Number(room.id) === Number(item.roomId);
    });

    const room = matchedRoom || {
      id: Number(item.roomId || 0),
      name: item.roomName || 'Phòng',
      type: item.roomType || 'Standard',
      price: Number(item.pricePerNight || 0),
      description: 'Không có mô tả.',
      img: pickFallbackImage(item.roomName || item.roomId)
    };

    const reasons = [
      item.reason || (Number(item.matchScore || 0) >= 85
        ? 'Mức tương thích rất cao theo tiêu chí của bạn'
        : 'Mức tương thích tốt theo dữ liệu hiện tại')
    ];

    return {
      ...room,
      score: Number(item.matchScore || 0),
      reasons,
      engine
    };
  });

  if (recommendation && normalized.length > 0) {
    normalized[0].reasons = [
      recommendation.reason || normalized[0].reasons[0],
      'Điểm phù hợp: ' + String(recommendation.matchScore || normalized[0].score || 0) + '%',
    ];
  }

  if (normalized.length === 0 && recommendation) {
    return [{
      id: Number(recommendation.roomId || 0),
      name: recommendation.roomName || 'Phòng',
      type: recommendation.roomType || 'Standard',
      price: Number(recommendation.pricePerNight || 0),
      description: 'Gợi ý AI từ backend.',
      img: recommendation.imageUrl || pickFallbackImage(recommendation.roomName || recommendation.roomId),
      score: Number(recommendation.matchScore || 0),
      reasons: [recommendation.reason || 'Gợi ý từ backend', 'Engine backend: ' + engine],
      engine
    }];
  }

  return normalized;
}

document.getElementById('searchForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const budget = parseFloat(document.getElementById('budget').value) || 0;
  const guestCountInput = parseInt(document.getElementById('guestCount').value, 10);
  const type = document.getElementById('roomType').value;
  const prompt = document.getElementById('aiPrompt').value || '';
  const checkInDate = document.getElementById('checkIn').value || '';
  const checkOutDate = document.getElementById('checkOut').value || '';
  const guestCount = Number.isFinite(guestCountInput) && guestCountInput > 0 ? guestCountInput : getGuestCountFromRoomType(type);

  currentSearchContext = {
    checkIn: checkInDate,
    checkOut: checkOutDate,
    budget: budget > 0 ? String(budget) : '',
    roomType: type,
    prompt: prompt,
    guestCount: guestCount
  };

  if (checkInDate && checkOutDate && new Date(checkOutDate) <= new Date(checkInDate)) {
    showToast('Ngày trả phòng phải sau ngày nhận phòng.', 'error');
    return;
  }

  document.getElementById('aiRecommendations').style.display = 'block';
  document.getElementById('aiResultsGrid').innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#64748b;">AI đang phân tích...</p>';

  let recommendations = [];
  try {
    recommendations = await fetchAiRecommendations({
      customerQuery: 'Khách vãng lai',
      budget,
      roomPurpose: getPurposeFromRoomType(type),
      prompt,
      checkInDate,
      checkOutDate,
      guestCount
    });
  } catch (error) {
    recommendations = localRecommendFallback({ budget, type, prompt });
    showToast(error.message || 'AI backend tạm lỗi, đã dùng gợi ý dự phòng.', 'error');
  }

  displayAI(recommendations);
  
  setTimeout(() => {
    document.getElementById('aiRecommendations').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
});

function displayAI(rooms) {
  const sec = document.getElementById('aiRecommendations');
  sec.style.display = 'block';

  if (!rooms || rooms.length === 0) {
    document.getElementById('aiResultsGrid').innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#64748b;">Chưa có gợi ý phù hợp.</p>';
    return;
  }

  document.getElementById('aiResultsGrid').innerHTML = rooms.map((room, i) => {
    const best = i === 0;
    return `
      <div style="position:relative; ${best ? 'transform: translateY(-8px);' : ''}">
        
        <div class="room-card-pub hover-lift" onclick="window.location.href='${roomDetailUrl(room.id)}'" style="position: relative; ${best ? 'border: 1px solid var(--color-gold); box-shadow: 0 20px 40px rgba(0,0,0,0.08);' : 'border: 1px solid rgba(226,232,240,0.5);'}">
          ${best ? '<div style="position: absolute; top: 16px; right: 16px; z-index: 10; background: var(--c-gold, #c5a059); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(197,160,89,0.3);"><span class="material-symbols-outlined" style="font-size: 18px;">star</span></div>' : ''}
          <div class="room-card-pub__img-wrap" style="height: 14rem;">
            <img class="room-card-pub__img" src="${room.img}" alt="${room.name}"/>
            <div class="room-card-pub__badge">${room.type}</div>
          </div>
          <div class="room-card-pub__body">
            <h3 style="font-family:var(--font-serif);font-size:1.5rem;font-weight:500;margin-bottom:1.5rem;color:#0f172a; padding-right: ${best ? '24px' : '0'};">${room.name}</h3>
            
            <div style="display:flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0;">
              ${room.reasons.map(r => `
                <div style="display: flex; align-items: flex-start; text-align: left; gap: 0.5rem; font-size: 0.8125rem; color: #64748b; font-weight:300;">
                  <span class="material-symbols-outlined" style="font-size: 1rem; color:var(--color-gold); margin-top: 0.1rem; flex-shrink: 0;">check_circle</span>
                  <span style="line-height: 1.5;">${r}</span>
                </div>
              `).join('')}
            </div>

            <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; font-weight:700; color:var(--color-gold); margin-bottom: 2rem;">Từ ${room.price.toLocaleString('vi-VN')}₫ / đêm</div>
            <button class="room-card-pub__footer" style="${best ? 'background:var(--color-gold); color:#fff; border-color:var(--color-gold);' : ''}">KHÁM PHÁ CHI TIẾT</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.onload = () => {
  
  var checkInEl = document.getElementById('checkIn');
  var checkOutEl = document.getElementById('checkOut');
  var today = new Date().toISOString().split('T')[0];
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (checkInEl && !checkInEl.value) checkInEl.value = today;
  if (checkOutEl && !checkOutEl.value) checkOutEl.value = tomorrowStr;

  currentSearchContext.checkIn = checkInEl ? checkInEl.value : '';
  currentSearchContext.checkOut = checkOutEl ? checkOutEl.value : '';

  fetchRooms()
    .then(() => {
      renderAllRooms();
      var countEl = document.getElementById('roomResultCount');
      if (countEl) {
        countEl.textContent = 'Hiển thị ' + roomsData.length + ' kết quả';
      }
    })
    .catch((error) => {
      showToast(error.message || 'Không thể tải dữ liệu phòng.', 'error');
      renderAllRooms();
    });
};
