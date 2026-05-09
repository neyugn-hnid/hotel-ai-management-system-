(function () {
  "use strict";

  const DASHBOARD_API = "https://localhost:7082/api/Dashboard/summary";

  
  function formatCurrency(amount) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  }

  function formatCompactCurrency(amount) {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + "M ₫";
    }
    return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " ₫";
  }

  function formatNumber(num) {
    return new Intl.NumberFormat("vi-VN").format(num);
  }

  function toast(message, variant) {
    if (window.AppCore && typeof window.AppCore.toast === "function") {
      window.AppCore.toast(message, variant);
    } else {
      console.log(message);
    }
  }

  function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    return headers;
  }

  
  function getStatusTag(status) {
    const s = (status || "").toLowerCase();
    if (s.includes("check-in") || s.includes("đang ở"))
      return { cls: "tag tag-blue", label: "Check-in" };
    if (s.includes("check-out"))
      return { cls: "tag tag-blue", label: "Check-out" };
    if (s.includes("vip"))
      return { cls: "tag tag-gold", label: "VIP Guest" };
    if (s.includes("đã xác nhận"))
      return { cls: "tag", style: "background:#E7F3EF;color:#0D7350;", label: "Đã xác nhận" };
    if (s.includes("chờ"))
      return { cls: "tag", style: "background:#FFF2E0;color:#D97706;", label: "Chờ xác nhận" };
    if (s.includes("hủy"))
      return { cls: "tag", style: "background:#FEE2E2;color:#EF4444;", label: "Đã hủy" };
    return { cls: "tag", style: "background:#F6F5F4;color:#666;", label: status || "Đã đặt" };
  }

  function getGuestAvatarStyle(name) {
    const colors = [
      "#C5A059", "#0075DE", "#0D7350", "#D97706",
      "#7C3AED", "#DC2626", "#0891B2", "#4F46E5",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  
  async function fetchDashboardData() {
    try {
      const res = await fetch(DASHBOARD_API, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại", "error");
          return null;
        }
        throw new Error("API error: " + res.status);
      }

      return await res.json();
    } catch (err) {
      console.error("Dashboard fetch failed:", err);
      toast("Không thể tải dữ liệu tổng quan", "error");
      return null;
    }
  }

  
  function renderStatCards(data) {
    if (!data) return;

    const trendUp =
      '<span class="material-symbols-outlined" style="font-size:14px;">trending_up</span>';
    const trendDown =
      '<span class="material-symbols-outlined" style="font-size:14px;">trending_down</span>';

    
    const occEl = document.querySelector(".bento-card:nth-child(1) .stat-value");
    const occTrendEl = document.querySelector(".bento-card:nth-child(1) .stat-trend");
    if (occEl) occEl.textContent = data.occupancyRate + "%";
    if (occTrendEl) {
      occTrendEl.className = "stat-trend " + (data.occupancyRate >= 80 ? "trend-up" : "trend-down");
      occTrendEl.innerHTML =
        (data.occupancyRate >= 80 ? trendUp : trendDown) +
        " " +
        data.occupiedRooms +
        "/" +
        data.totalRooms +
        " phòng";
    }

    
    const revEl = document.querySelector(".bento-card:nth-child(2) .stat-value");
    const revTrendEl = document.querySelector(".bento-card:nth-child(2) .stat-trend");
    if (revEl) revEl.textContent = formatCompactCurrency(data.avgRevenuePerRoom);
    if (revTrendEl) {
      revTrendEl.className = "stat-trend trend-up";
      revTrendEl.innerHTML = trendUp + " TB 30 ngày";
    }

    
    const guestEl = document.querySelector(".bento-card:nth-child(3) .stat-value");
    const guestTrendEl = document.querySelector(".bento-card:nth-child(3) .stat-trend");
    if (guestEl) guestEl.textContent = formatNumber(data.guestsStaying);
    if (guestTrendEl) {
      guestTrendEl.className = "stat-trend trend-up";
      guestTrendEl.innerHTML = trendUp + " " + formatNumber(data.guestsStaying) + " khách";
    }

    
    const bookingEl = document.querySelector(".bento-card:nth-child(4) .stat-value");
    const bookingTrendEl = document.querySelector(".bento-card:nth-child(4) .stat-trend");
    if (bookingEl) bookingEl.textContent = formatNumber(data.newBookingsToday);
    if (bookingTrendEl) {
      const trend = data.bookingTrend || 0;
      bookingTrendEl.className = "stat-trend " + (trend >= 0 ? "trend-up" : "trend-down");
      bookingTrendEl.innerHTML =
        (trend >= 0 ? trendUp : trendDown) +
        " " +
        (trend >= 0 ? "+" : "") +
        trend +
        " booking";
    }
  }

  
  function renderRecentActivity(data) {
    if (!data || !data.recentActivities) return;

    const container = document.querySelector(".guest-list");
    if (!container) return;

    container.innerHTML = "";

    data.recentActivities.forEach(function (item) {
      const initials = item.guestInitials || "?";
      const bgColor = getGuestAvatarStyle(item.guestName);
      const tag = getStatusTag(item.status);

      const row = document.createElement("div");
      row.className = "guest-row";
      row.innerHTML =
        '<div class="guest-info">' +
        '<div class="guest-avatar" style="background:' +
        bgColor +
        ';">' +
        initials +
        "</div>" +
        "<div>" +
        '<div class="guest-name">' +
        item.guestName +
        "</div>" +
        '<div class="guest-meta">' +
        item.roomName +
        " • " +
        item.nights +
        " đêm</div>" +
        "</div>" +
        "</div>" +
        '<span class="' +
        (tag.cls || "tag") +
        '"' +
        (tag.style ? ' style="' + tag.style + '"' : "") +
        ">" +
        tag.label +
        "</span>" +
        '<div style="text-align:right;">' +
        '<div style="font-weight:700;font-size:14px;">' +
        formatCompactCurrency(item.amount) +
        "</div>" +
        '<div class="guest-meta">' +
        item.timeAgo +
        "</div>" +
        "</div>";

      container.appendChild(row);
    });
  }

  
  function renderRoomStatusBreakdown(data) {
    if (!data) return;

    
    var occEl = document.getElementById("roomStatOccupied");
    var bookEl = document.getElementById("roomStatBooked");
    var availEl = document.getElementById("roomStatAvailable");
    var cleanEl = document.getElementById("roomStatCleaning");
    var readyEl = document.getElementById("roomReadyCount");
    var centerEl = document.getElementById("roomCenterTotal");

    if (occEl) occEl.textContent = formatNumber(data.occupiedRooms);
    if (bookEl) bookEl.textContent = formatNumber(data.bookedRooms);
    if (availEl) availEl.textContent = formatNumber(data.availableRooms);
    if (cleanEl) cleanEl.textContent = formatNumber(data.cleaningRooms);

    if (readyEl) {
      readyEl.innerHTML =
        formatNumber(data.availableRooms) +
        ' <span style="font-size:14px;font-weight:500;color:var(--dash-muted);">/ ' +
        formatNumber(data.totalRooms) +
        "</span>";
    }

    if (centerEl) {
      centerEl.textContent = formatNumber(data.totalRooms);
    }
  }

  
  let mainChartInstance = null;
  let customerChartInstance = null;
  let roomStatusChartInstance = null;

  function destroyCharts() {
    if (mainChartInstance) { mainChartInstance.destroy(); mainChartInstance = null; }
    if (customerChartInstance) { customerChartInstance.destroy(); customerChartInstance = null; }
    if (roomStatusChartInstance) { roomStatusChartInstance.destroy(); roomStatusChartInstance = null; }
  }

  function initCharts(data) {
    if (typeof Chart === "undefined") return;

    const dailyStats = data.dailyStats || [];
    const labels = dailyStats.map(function (d) {
      return d.date;
    });
    const revenueData = dailyStats.map(function (d) {
      return d.revenue;
    });
    const bookingCounts = dailyStats.map(function (d) {
      return d.bookings;
    });
    const guestCounts = dailyStats.map(function (d) {
      return d.guests;
    });
    const occupancyData = data.occupancyTrend || [];

    
    const ctxMain = document.getElementById("mainChart");
    if (ctxMain) {
      mainChartInstance = new Chart(ctxMain.getContext("2d"), {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Công suất phòng (%)",
              type: "line",
              data: occupancyData,
              borderColor: "#050505",
              backgroundColor: "#050505",
              borderWidth: 2,
              pointBackgroundColor: "#fff",
              pointBorderColor: "#050505",
              pointBorderWidth: 2,
              pointRadius: 4,
              tension: 0.3,
              yAxisID: "y1",
              order: 1,
            },
            {
              label: "Doanh thu (VNĐ)",
              type: "bar",
              data: revenueData,
              backgroundColor: "#C5A059",
              borderRadius: 6,
              barPercentage: 0.6,
              yAxisID: "y",
              order: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                boxHeight: 8,
                font: {
                  family: "'Inter', sans-serif",
                  size: 12,
                  weight: "500",
                },
              },
            },
            tooltip: {
              backgroundColor: "#050505",
              titleFont: { family: "'Inter', sans-serif", size: 13 },
              bodyFont: { family: "'Inter', sans-serif", size: 13 },
              padding: 12,
              cornerRadius: 8,
              displayColors: true,
              callbacks: {
                label: function (context) {
                  let label = context.dataset.label || "";
                  if (label) label += ": ";
                  if (context.dataset.yAxisID === "y") {
                    label += context.raw.toLocaleString("vi-VN") + " ₫";
                  } else {
                    label += context.raw + "%";
                  }
                  return label;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false, drawBorder: false },
              ticks: {
                font: { family: "'Inter', sans-serif", size: 12 },
                color: "#6C757D",
              },
            },
            y: {
              type: "linear",
              display: true,
              position: "left",
              grid: { color: "rgba(0,0,0,0.04)", drawBorder: false },
              ticks: {
                font: { family: "'Inter', sans-serif", size: 12 },
                color: "#6C757D",
                callback: function (value) {
                  if (value >= 1000000)
                    return (value / 1000000).toFixed(0) + "M ₫";
                  return value.toLocaleString("vi-VN") + " ₫";
                },
              },
            },
            y1: {
              type: "linear",
              display: true,
              position: "right",
              grid: { drawOnChartArea: false },
              ticks: {
                font: { family: "'Inter', sans-serif", size: 12 },
                color: "#6C757D",
                callback: function (value) {
                  return value + "%";
                },
              },
            },
          },
        },
      });
    }

    
    const ctxCustomer = document.getElementById("customerChart");
    if (ctxCustomer) {
      customerChartInstance = new Chart(ctxCustomer.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Số lượng đặt phòng",
              data: bookingCounts,
              borderColor: "#0075DE",
              backgroundColor: "rgba(0, 117, 222, 0.1)",
              borderWidth: 2,
              fill: true,
              pointBackgroundColor: "#fff",
              pointBorderColor: "#0075DE",
              pointBorderWidth: 2,
              pointRadius: 4,
              tension: 0.4,
            },
            {
              label: "Khách lưu trú",
              data: guestCounts,
              borderColor: "#C5A059",
              backgroundColor: "transparent",
              borderWidth: 2,
              borderDash: [5, 5],
              pointBackgroundColor: "#fff",
              pointBorderColor: "#C5A059",
              pointBorderWidth: 2,
              pointRadius: 4,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                boxHeight: 8,
                font: {
                  family: "'Inter', sans-serif",
                  size: 12,
                  weight: "500",
                },
              },
            },
            tooltip: {
              backgroundColor: "#050505",
              titleFont: { family: "'Inter', sans-serif", size: 13 },
              bodyFont: { family: "'Inter', sans-serif", size: 13 },
              padding: 12,
              cornerRadius: 8,
              displayColors: true,
            },
          },
          scales: {
            x: {
              grid: { display: false, drawBorder: false },
              ticks: {
                font: { family: "'Inter', sans-serif", size: 12 },
                color: "#6C757D",
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.04)", drawBorder: false },
              ticks: {
                font: { family: "'Inter', sans-serif", size: 12 },
                color: "#6C757D",
              },
            },
          },
        },
      });
    }

    
    const ctxRoom = document.getElementById("roomStatusChart");
    if (ctxRoom) {
      roomStatusChartInstance = new Chart(ctxRoom.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["Đang ở", "Đã đặt", "Trống (Sẵn sàng)", "Đang dọn dẹp"],
          datasets: [
            {
              data: [
                data.occupiedRooms || 0,
                data.bookedRooms || 0,
                data.availableRooms || 0,
                data.cleaningRooms || 0,
              ],
              backgroundColor: ["#C5A059", "#0075DE", "#F6F5F4", "#DC2626"],
              borderWidth: 0,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "75%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#050505",
              titleFont: { family: "'Inter', sans-serif", size: 13 },
              bodyFont: { family: "'Inter', sans-serif", size: 13 },
              padding: 12,
              cornerRadius: 8,
              displayColors: true,
            },
          },
        },
      });

      
      var centerTotal = document.getElementById("roomCenterTotal");
      if (centerTotal) {
        centerTotal.textContent = formatNumber(data.totalRooms || 0);
      }
    }
  }

  
  function loadChartJs() {
    return new Promise(function (resolve, reject) {
      if (typeof Chart !== "undefined") {
        resolve();
        return;
      }

      const existingScript = document.querySelector(
        'script[data-chartjs-loader]'
      );
      if (existingScript) {
        existingScript.addEventListener("load", resolve, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      script.async = true;
      script.dataset.chartjsLoader = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.body.appendChild(script);
    });
  }

  
  async function initDashboard() {
    
    const data = await fetchDashboardData();
    if (!data) return;

    renderStatCards(data);
    renderRecentActivity(data);
    renderRoomStatusBreakdown(data);

    await loadChartJs();
    destroyCharts();
    initCharts(data);
  }

  
  document.addEventListener("DOMContentLoaded", function () {
    const init = function () {
      initDashboard().catch(function (err) {
        console.error("Dashboard init failed:", err);
      });
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(init, { timeout: 1200 });
    } else {
      setTimeout(init, 0);
    }
  });
})();
