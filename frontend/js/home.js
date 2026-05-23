(function initHome(global) {
  "use strict";

  var core = global.AppCore;
  if (!core) return;

  var qs = core.qs;
  var qsa = core.qsa;
  var throttle = core.throttle;

  function setNavbarStickyEffect(navbar) {
    if (!navbar) return;

    var onScroll = throttle(function updateNavbar() {
      if (window.scrollY > 20) {
        navbar.style.backdropFilter = "blur(16px)";
        navbar.style.boxShadow = "0 10px 32px rgba(15, 23, 42, 0.08)";
      } else {
        navbar.style.backdropFilter = "none";
        navbar.style.boxShadow = "none";
      }
    }, 90);

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function setupSmoothScroll() {
    var links = qsa("[data-scroll-link]");

    links.forEach(function bind(link) {
      link.addEventListener("click", function onClick(event) {
        var key = link.getAttribute("data-scroll-link");
        var target = qs("[data-section='" + key + "']");

        if (!target) return;
        event.preventDefault();

        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  }

  function setupRevealAnimation() {
    var revealItems = qsa("[data-reveal]");

    revealItems.forEach(function prep(item, index) {
      item.style.opacity = "0";
      item.style.transform = "translateY(22px)";
      item.style.transition = "opacity 420ms ease, transform 420ms ease";
      item.style.transitionDelay = Math.min(index * 60, 220) + "ms";
    });

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach(function show(item) {
        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
      });
      return;
    }

    var observer = new IntersectionObserver(function onVisible(entries) {
      entries.forEach(function handle(entry) {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.2
    });

    revealItems.forEach(function watch(item) {
      observer.observe(item);
    });
  }

  function setupActiveNav() {
    var navLinks = qsa(".navbar__link[data-scroll-link]");
    var sections = qsa("[data-section]");

    if (!navLinks.length || !sections.length) return;

    var sectionMap = {};
    sections.forEach(function mapSection(section) {
      sectionMap[section.getAttribute("data-section")] = section;
    });

    var onScroll = throttle(function updateActive() {
      var currentKey = "";
      var triggerPoint = window.scrollY + window.innerHeight * 0.33;

      sections.forEach(function find(section) {
        if (triggerPoint >= section.offsetTop) {
          currentKey = section.getAttribute("data-section");
        }
      });

      qsa(".navbar__link").forEach(function(l) { l.classList.remove("navbar__link--active"); });
      navLinks.forEach(function toggle(link) {
        var key = link.getAttribute("data-scroll-link");
        if (key === currentKey) {
          link.classList.add("navbar__link--active");
        }
      });
    }, 100);

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  document.addEventListener("DOMContentLoaded", function onReady() {
    var navbar = qs(".navbar");
    setNavbarStickyEffect(navbar);
    setupSmoothScroll();
    setupRevealAnimation();
    setupActiveNav();
    initIndexDates();
    loadFeaturedRooms();
    setCopyrightYear();
  });

  
  function setCopyrightYear() {
    var el = document.getElementById("copyrightYear");
    if (el) el.textContent = new Date().getFullYear();
  }

  
  function initIndexDates() {
    var today = new Date();
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    var fmt = function(d) {
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
    };

    var checkIn = document.getElementById("indexCheckIn");
    var checkOut = document.getElementById("indexCheckOut");
    if (checkIn && !checkIn.value) checkIn.value = fmt(today);
    if (checkOut && !checkOut.value) checkOut.value = fmt(tomorrow);
  }

  
  function loadFeaturedRooms() {
    var ROOMS_API = "https://localhost:7082/api/Rooms?pageNumber=1&pageSize=3&sortBy=createdAt&sortDir=asc&publicOnly=true&availableOnly=true";

    fetch(ROOMS_API)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var rooms = data.items || data.data || [];
        if (!rooms.length) return;

        var typeMap = { "Standard": "STANDARD", "Deluxe": "DELUXE", "Suite": "SUITE", "Penthouse": "PENTHOUSE" };
        var fallbackImages = [
          "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
          "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80"
        ];

        rooms.forEach(function(room, i) {
          var idx = i + 1;
          var typeEl = document.getElementById("roomCard" + idx + "Type");
          var nameEl = document.getElementById("roomCard" + idx + "Name");
          var priceEl = document.getElementById("roomCard" + idx + "Price");
          var cardEl = document.querySelectorAll(".rooms-grid .room-card")[i];
          var imageEl = cardEl ? cardEl.querySelector(".room-card__bg") : null;

          var roomType = room.roomType || "Standard";
          var displayType = typeMap[roomType] || roomType.toUpperCase();
          var roomName = room.cardName || room.name || ("Phòng " + idx);
          var roomId = room.id || room.Id;
          var firstImage = Array.isArray(room.images) && room.images.length
            ? (room.images[0].imageUrl || room.images[0].url || "")
            : "";

          if (typeEl) typeEl.textContent = ("0" + idx).slice(-2) + " / " + displayType;
          if (nameEl) nameEl.textContent = roomName;

          if (priceEl) {
            var p = new Intl.NumberFormat("vi-VN").format(room.pricePerNight || 0);
            priceEl.textContent = p + " VNĐ / ĐÊM";
          }

          if (imageEl && firstImage) {
            imageEl.src = firstImage;
            imageEl.alt = roomName;
          } else if (imageEl) {
            imageEl.alt = roomName;
            imageEl.src = fallbackImages[i] || fallbackImages[0];
          }

          if (cardEl && roomId) {
            cardEl.onclick = function() {
              window.location.href = "room-detail.html?id=" + encodeURIComponent(roomId);
            };
          }
        });
      })
      .catch(function(err) {

      });
  }
})(window);
