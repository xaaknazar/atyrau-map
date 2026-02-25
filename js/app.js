(function () {
    "use strict";

    // ── Category config ─────────────────────────────────────
    var CATEGORIES = {
        "blind-spots": { color: "#e74c3c", label: "Слепая зона" },
        "abandoned":   { color: "#f39c12", label: "Заброшенное здание" },
        "unlit":       { color: "#8e44ad", label: "Неосвещённая улица" }
    };

    // ── Map init (Atyrau center) ────────────────────────────
    var map = L.map("map", {
        center: [47.1067, 51.9203],
        zoom: 14,
        zoomControl: true,
        maxZoom: 18,
        minZoom: 11
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // ── Layer groups per category ───────────────────────────
    var layers = {};
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

    mapPoints.forEach(function (point) {
        var marker = L.marker([point.lat, point.lng], {
            icon: createMarkerIcon(point.category)
        });

        marker.on("click", function () {
            openModal(point);
        });

        // Tooltip on hover
        marker.bindTooltip(point.title, {
            direction: "top",
            offset: [0, -12],
            className: "marker-tooltip"
        });

        if (layers[point.category]) {
            layers[point.category].addLayer(marker);
        }
    });

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

    // ── Modal ───────────────────────────────────────────────
    var overlay = document.getElementById("modal-overlay");
    var modalTitle = document.getElementById("modal-title");
    var modalBadge = document.getElementById("modal-badge");
    var modalGallery = document.getElementById("modal-gallery");
    var modalDescription = document.getElementById("modal-description");
    var modalAddress = document.getElementById("modal-address");

    function openModal(point) {
        modalTitle.textContent = point.title;

        // Badge
        modalBadge.textContent = CATEGORIES[point.category].label;
        modalBadge.className = point.category;

        // Gallery
        modalGallery.innerHTML = "";
        if (point.photos && point.photos.length > 0) {
            point.photos.forEach(function (src) {
                var img = document.createElement("img");
                img.src = src;
                img.alt = point.title;
                img.loading = "lazy";
                img.addEventListener("click", function () {
                    openLightbox(src);
                });
                modalGallery.appendChild(img);
            });
        }

        modalDescription.textContent = point.description;
        modalAddress.textContent = point.address;

        overlay.classList.remove("hidden");
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

})();
