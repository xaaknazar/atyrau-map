(function () {
    "use strict";

    // ── Category config ─────────────────────────────────────
    var CATEGORIES = {
        "blind-spots": { color: "#e74c3c", badgeKey: "badge_blind" },
        "abandoned":   { color: "#f39c12", badgeKey: "badge_abandoned" },
        "unlit":       { color: "#8e44ad", badgeKey: "badge_unlit" }
    };

    // ── Helper: get localized field ─────────────────────────
    function loc(point, field) {
        return point[field + "_" + currentLang] || point[field + "_ru"] || "";
    }

    // ── Map init (Atyrau center) ────────────────────────────
    var map = L.map("map", {
        center: [47.1067, 51.9203],
        zoom: 14,
        zoomControl: false,
        maxZoom: 18,
        minZoom: 11
    });

    // Place zoom control at bottom-right (better for mobile)
    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // ── Layer groups per category ───────────────────────────
    var layers = {};
    var markers = [];

    Object.keys(CATEGORIES).forEach(function (cat) {
        layers[cat] = L.markerClusterGroup({
            maxClusterRadius: 40,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
        });
        map.addLayer(layers[cat]);
    });

    // ── Create markers ──────────────────────────────────────
    function createMarkerIcon(category) {
        return L.divIcon({
            className: "custom-marker",
            html: '<div class="marker-pin ' + category + '"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    function buildMarkers() {
        // Clear existing
        markers.forEach(function (m) {
            if (layers[m._pointCategory]) {
                layers[m._pointCategory].removeLayer(m);
            }
        });
        markers = [];

        mapPoints.forEach(function (point) {
            var marker = L.marker([point.lat, point.lng], {
                icon: createMarkerIcon(point.category)
            });
            marker._pointData = point;
            marker._pointCategory = point.category;

            marker.on("click", function () {
                openModal(point);
            });

            marker.bindTooltip(loc(point, "title"), {
                direction: "top",
                offset: [0, -12],
                className: "marker-tooltip"
            });

            if (layers[point.category]) {
                layers[point.category].addLayer(marker);
            }
            markers.push(marker);
        });
    }

    buildMarkers();

    // Rebuild tooltips on language switch
    function refreshTooltips() {
        markers.forEach(function (marker) {
            marker.unbindTooltip();
            marker.bindTooltip(loc(marker._pointData, "title"), {
                direction: "top",
                offset: [0, -12],
                className: "marker-tooltip"
            });
        });
    }

    // ── Update stats ────────────────────────────────────────
    function updateStats() {
        var counts = { "blind-spots": 0, "abandoned": 0, "unlit": 0 };
        mapPoints.forEach(function (p) {
            counts[p.category]++;
        });

        document.getElementById("count-blind-spots").textContent = counts["blind-spots"];
        document.getElementById("count-abandoned").textContent = counts["abandoned"];
        document.getElementById("count-unlit").textContent = counts["unlit"];
        document.getElementById("count-total").textContent = mapPoints.length;
    }
    updateStats();

    // ── Filter checkboxes ───────────────────────────────────
    document.querySelectorAll("[data-filter]").forEach(function (checkbox) {
        checkbox.addEventListener("change", function () {
            var category = this.getAttribute("data-filter");
            if (this.checked) {
                map.addLayer(layers[category]);
            } else {
                map.removeLayer(layers[category]);
            }
        });
    });

    // ── Language switch ─────────────────────────────────────
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var lang = this.getAttribute("data-lang");
            setLanguage(lang);
            refreshTooltips();
        });
    });

    // Apply saved language on load
    setLanguage(currentLang);

    // ── Modal ───────────────────────────────────────────────
    var overlay = document.getElementById("modal-overlay");
    var modalTitle = document.getElementById("modal-title");
    var modalBadge = document.getElementById("modal-badge");
    var modalGallery = document.getElementById("modal-gallery");
    var modalDescription = document.getElementById("modal-description");
    var modalAddress = document.getElementById("modal-address");

    function openModal(point) {
        modalTitle.textContent = loc(point, "title");

        // Badge
        var badgeKey = CATEGORIES[point.category].badgeKey;
        modalBadge.textContent = t(badgeKey);
        modalBadge.className = point.category;

        // Gallery
        modalGallery.innerHTML = "";
        if (point.photos && point.photos.length > 0) {
            point.photos.forEach(function (src) {
                var img = document.createElement("img");
                img.src = src;
                img.alt = loc(point, "title");
                img.loading = "lazy";
                img.addEventListener("click", function () {
                    openLightbox(src);
                });
                modalGallery.appendChild(img);
            });
        }

        modalDescription.textContent = loc(point, "description");
        modalAddress.textContent = loc(point, "address");

        overlay.classList.remove("hidden");

        // Close mobile sidebar if open
        closeMobileSidebar();
    }

    function closeModal() {
        overlay.classList.add("hidden");
    }

    document.getElementById("modal-close").addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeLightbox();
            closeModal();
            closeMobileSidebar();
        }
    });

    // ── Lightbox (full-size photo view) ─────────────────────
    function openLightbox(src) {
        var lb = document.createElement("div");
        lb.id = "lightbox";
        var img = document.createElement("img");
        img.src = src;
        lb.appendChild(img);
        lb.addEventListener("click", function () {
            closeLightbox();
        });
        document.body.appendChild(lb);
    }

    function closeLightbox() {
        var lb = document.getElementById("lightbox");
        if (lb) lb.remove();
    }

    // ── Mobile sidebar toggle ───────────────────────────────
    var sidebar = document.getElementById("sidebar");
    var sidebarOverlay = document.getElementById("sidebar-overlay");
    var menuBtn = document.getElementById("mobile-menu-btn");

    function openMobileSidebar() {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("active");
        document.body.classList.add("sidebar-open");
    }

    function closeMobileSidebar() {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("active");
        document.body.classList.remove("sidebar-open");
    }

    if (menuBtn) {
        menuBtn.addEventListener("click", function () {
            if (sidebar.classList.contains("open")) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", closeMobileSidebar);
    }

    // Fix map size after any layout change
    window.addEventListener("resize", function () {
        setTimeout(function () { map.invalidateSize(); }, 100);
    });

})();
