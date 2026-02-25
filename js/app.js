(function () {
    "use strict";

    // ── Config ──────────────────────────────────────────────
    var ADMIN_PASSWORD = "prokuratura2025";

    var CATEGORIES = {
        "blind-spots": { color: "#3498db", badgeKey: "badge_blind" },
        "abandoned":   { color: "#8e44ad", badgeKey: "badge_abandoned" },
        "unlit":       { color: "#f39c12", badgeKey: "badge_unlit" }
    };

    var isAdmin = false;

    // ── Helper: localized field ─────────────────────────────
    function loc(point, field) {
        return point[field + "_" + currentLang] || point[field + "_ru"] || "";
    }

    // ── Map init ────────────────────────────────────────────
    var map = L.map("map", {
        center: [47.1067, 51.9203],
        zoom: 14,
        zoomControl: false,
        maxZoom: 18,
        minZoom: 11
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // ── Layers ──────────────────────────────────────────────
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

    function createMarkerIcon(category) {
        return L.divIcon({
            className: "custom-marker",
            html: '<div class="marker-pin ' + category + '"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    // ── Build / rebuild all markers ─────────────────────────
    function buildMarkers() {
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

        updateStats();
    }

    // Initial build + live updates from Firebase / localStorage
    onDataChanged(function () {
        buildMarkers();
    });

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

    // ── Stats ───────────────────────────────────────────────
    function updateStats() {
        var counts = { "blind-spots": 0, "abandoned": 0, "unlit": 0 };
        mapPoints.forEach(function (p) { if (counts.hasOwnProperty(p.category)) counts[p.category]++; });

        document.getElementById("count-blind-spots").textContent = counts["blind-spots"];
        document.getElementById("count-abandoned").textContent = counts["abandoned"];
        document.getElementById("count-unlit").textContent = counts["unlit"];
        document.getElementById("count-total").textContent = mapPoints.length;
    }

    // ── Filter checkboxes ───────────────────────────────────
    document.querySelectorAll("[data-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
            var cat = this.getAttribute("data-filter");
            if (this.checked) map.addLayer(layers[cat]);
            else map.removeLayer(layers[cat]);
        });
    });

    // ── Language switch ─────────────────────────────────────
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            setLanguage(this.getAttribute("data-lang"));
            refreshTooltips();
        });
    });
    setLanguage(currentLang);

    // ═══════════════════════════════════════════════════════
    //  VIEW MODAL (click on a point)
    // ═══════════════════════════════════════════════════════
    var viewOverlay   = document.getElementById("modal-overlay");
    var modalTitle    = document.getElementById("modal-title");
    var modalBadge    = document.getElementById("modal-badge");
    var modalGallery  = document.getElementById("modal-gallery");
    var modalDesc     = document.getElementById("modal-description");
    var modalAddr     = document.getElementById("modal-address");
    var modalDelBtn   = document.getElementById("modal-delete-btn");
    var currentModalPoint = null;

    function openModal(point) {
        currentModalPoint = point;
        modalTitle.textContent = loc(point, "title");
        modalBadge.textContent = t(CATEGORIES[point.category].badgeKey);
        modalBadge.className = point.category;

        modalGallery.innerHTML = "";
        (point.photos || []).forEach(function (src) {
            var img = document.createElement("img");
            img.src = src;
            img.alt = loc(point, "title");
            img.loading = "lazy";
            img.addEventListener("click", function () { openLightbox(src); });
            modalGallery.appendChild(img);
        });

        modalDesc.textContent = loc(point, "description");
        modalAddr.textContent = loc(point, "address");

        // Show delete button only in admin mode
        if (isAdmin) {
            modalDelBtn.classList.remove("hidden");
        } else {
            modalDelBtn.classList.add("hidden");
        }

        viewOverlay.classList.remove("hidden");
        closeMobileSidebar();
    }

    function closeModal() {
        viewOverlay.classList.add("hidden");
        currentModalPoint = null;
    }

    document.getElementById("modal-close").addEventListener("click", closeModal);
    viewOverlay.addEventListener("click", function (e) {
        if (e.target === viewOverlay) closeModal();
    });

    // Delete point from modal
    modalDelBtn.addEventListener("click", function () {
        if (!currentModalPoint) return;
        if (!confirm(t("admin_confirm_delete"))) return;
        deletePoint(currentModalPoint.id);
        closeModal();
    });

    // ── Lightbox ────────────────────────────────────────────
    function openLightbox(src) {
        var lb = document.createElement("div");
        lb.id = "lightbox";
        var img = document.createElement("img");
        img.src = src;
        lb.appendChild(img);
        lb.addEventListener("click", function () { closeLightbox(); });
        document.body.appendChild(lb);
    }

    function closeLightbox() {
        var lb = document.getElementById("lightbox");
        if (lb) lb.remove();
    }

    // ── Escape key ──────────────────────────────────────────
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            closeLightbox();
            closeModal();
            closeLoginModal();
            closeAddModal();
            closeMobileSidebar();
        }
    });

    // ═══════════════════════════════════════════════════════
    //  MOBILE SIDEBAR
    // ═══════════════════════════════════════════════════════
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
            sidebar.classList.contains("open") ? closeMobileSidebar() : openMobileSidebar();
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", closeMobileSidebar);
    }

    window.addEventListener("resize", function () {
        setTimeout(function () { map.invalidateSize(); }, 100);
    });

    // ═══════════════════════════════════════════════════════
    //  ADMIN: LOGIN
    // ═══════════════════════════════════════════════════════
    var loginOverlay = document.getElementById("login-overlay");
    var loginError   = document.getElementById("login-error");
    var adminBar     = document.getElementById("admin-bar");

    function openLoginModal() {
        document.getElementById("admin-password").value = "";
        loginError.classList.add("hidden");
        loginOverlay.classList.remove("hidden");
    }

    function closeLoginModal() {
        loginOverlay.classList.add("hidden");
    }

    document.getElementById("admin-toggle-btn").addEventListener("click", function () {
        if (isAdmin) {
            exitAdmin();
        } else {
            openLoginModal();
        }
    });

    document.getElementById("login-close").addEventListener("click", closeLoginModal);
    loginOverlay.addEventListener("click", function (e) {
        if (e.target === loginOverlay) closeLoginModal();
    });

    document.getElementById("admin-login-submit").addEventListener("click", tryLogin);
    document.getElementById("admin-password").addEventListener("keydown", function (e) {
        if (e.key === "Enter") tryLogin();
    });

    function tryLogin() {
        var pwd = document.getElementById("admin-password").value;
        if (pwd === ADMIN_PASSWORD) {
            isAdmin = true;
            closeLoginModal();
            enterAdmin();
        } else {
            loginError.classList.remove("hidden");
        }
    }

    function enterAdmin() {
        isAdmin = true;
        adminBar.classList.remove("hidden");
        document.body.classList.add("admin-mode");
        document.getElementById("admin-toggle-btn").setAttribute("data-i18n", "admin_exit");
        document.getElementById("admin-toggle-btn").textContent = t("admin_exit");
        map.getContainer().style.cursor = "crosshair";
    }

    function exitAdmin() {
        isAdmin = false;
        adminBar.classList.add("hidden");
        document.body.classList.remove("admin-mode");
        document.getElementById("admin-toggle-btn").setAttribute("data-i18n", "admin_login");
        document.getElementById("admin-toggle-btn").textContent = t("admin_login");
        map.getContainer().style.cursor = "";
    }

    document.getElementById("admin-exit-btn").addEventListener("click", exitAdmin);

    // ═══════════════════════════════════════════════════════
    //  ADMIN: ADD POINT (click on map)
    // ═══════════════════════════════════════════════════════
    var addOverlay = document.getElementById("add-overlay");
    var addCoords  = document.getElementById("add-coords");
    var pendingLat = 0, pendingLng = 0;
    var selectedCategory = "blind-spots";
    var selectedPhotos = [];

    // Map click → open add form
    map.on("click", function (e) {
        if (!isAdmin) return;
        pendingLat = Math.round(e.latlng.lat * 10000) / 10000;
        pendingLng = Math.round(e.latlng.lng * 10000) / 10000;
        openAddModal();
    });

    function openAddModal() {
        addCoords.textContent = pendingLat.toFixed(4) + ", " + pendingLng.toFixed(4);

        // Reset form
        document.getElementById("add-title-ru").value = "";
        document.getElementById("add-title-kz").value = "";
        document.getElementById("add-address-ru").value = "";
        document.getElementById("add-address-kz").value = "";
        document.getElementById("add-desc-ru").value = "";
        document.getElementById("add-desc-kz").value = "";
        selectedCategory = "blind-spots";
        selectedPhotos = [];

        // Reset category buttons
        document.querySelectorAll(".cat-btn").forEach(function (btn) {
            btn.classList.toggle("active", btn.getAttribute("data-cat") === selectedCategory);
        });

        updatePhotoSectionVisibility();
        buildPhotoPicker();
        addOverlay.classList.remove("hidden");
    }

    function closeAddModal() {
        addOverlay.classList.add("hidden");
    }

    document.getElementById("add-close").addEventListener("click", closeAddModal);
    addOverlay.addEventListener("click", function (e) {
        if (e.target === addOverlay) closeAddModal();
    });

    // Category selector
    var photoSection = document.getElementById("photo-section");

    function updatePhotoSectionVisibility() {
        if (photoSection) {
            photoSection.style.display = "";
        }
    }

    document.querySelectorAll(".cat-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            selectedCategory = this.getAttribute("data-cat");
            document.querySelectorAll(".cat-btn").forEach(function (b) {
                b.classList.toggle("active", b.getAttribute("data-cat") === selectedCategory);
            });
            updatePhotoSectionVisibility();
            buildPhotoPicker();
        });
    });

    // ── Photo picker ────────────────────────────────────────
    function buildPhotoPicker() {
        var container = document.getElementById("photo-picker");
        container.innerHTML = "";
        selectedPhotos = [];

        AVAILABLE_PHOTOS.forEach(function (photo) {
            var item = document.createElement("label");
            item.className = "photo-pick-item";

            var checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = photo.file;
            checkbox.addEventListener("change", function () {
                if (this.checked) {
                    selectedPhotos.push(photo.file);
                    item.classList.add("selected");
                } else {
                    selectedPhotos = selectedPhotos.filter(function (f) { return f !== photo.file; });
                    item.classList.remove("selected");
                }
            });

            var thumb = document.createElement("img");
            thumb.src = photo.file;
            thumb.alt = currentLang === "kz" ? photo.label_kz : photo.label_ru;
            thumb.loading = "lazy";

            var label = document.createElement("span");
            label.className = "photo-pick-label";
            label.textContent = currentLang === "kz" ? photo.label_kz : photo.label_ru;

            item.appendChild(checkbox);
            item.appendChild(thumb);
            item.appendChild(label);
            container.appendChild(item);
        });
    }

    // ── Submit new point ────────────────────────────────────
    document.getElementById("add-submit").addEventListener("click", function () {
        var titleRu = document.getElementById("add-title-ru").value.trim();
        if (!titleRu) {
            document.getElementById("add-title-ru").focus();
            return;
        }

        var newPoint = {
            id: getNextId(),
            lat: pendingLat,
            lng: pendingLng,
            category: selectedCategory,
            title_ru: titleRu,
            title_kz: document.getElementById("add-title-kz").value.trim() || titleRu,
            address_ru: document.getElementById("add-address-ru").value.trim(),
            address_kz: document.getElementById("add-address-kz").value.trim(),
            description_ru: document.getElementById("add-desc-ru").value.trim(),
            description_kz: document.getElementById("add-desc-kz").value.trim(),
            photos: selectedPhotos.slice()
        };

        savePoint(newPoint);
        closeAddModal();
    });

    // ═══════════════════════════════════════════════════════
    //  ADMIN: RESET DATA (in sidebar)
    // ═══════════════════════════════════════════════════════
    // (reset button is shown only via admin; could be extended)

})();
