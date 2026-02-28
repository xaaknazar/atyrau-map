(function () {
    "use strict";

    // ── Config ──────────────────────────────────────────────
    var ADMIN_PASSWORD = "prokuratura2025";

    var CATEGORIES = {
        "crime":       { color: "#e74c3c", badgeKey: "badge_crime" },
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
    // Atyrau center + ~50 km bounding box
    var ATYRAU_CENTER = [47.1067, 51.9203];
    var ATYRAU_BOUNDS = L.latLngBounds(
        [46.65, 51.30],   // юго-запад (~50 км)
        [47.56, 52.54]    // северо-восток (~50 км)
    );

    var map = L.map("map", {
        center: ATYRAU_CENTER,
        zoom: 14,
        zoomControl: false,
        maxZoom: 18,
        minZoom: 11,
        maxBounds: ATYRAU_BOUNDS,
        maxBoundsViscosity: 1.0
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // ═══════════════════════════════════════════════════════
    //  TILE LAYERS (Map style switcher)
    // ═══════════════════════════════════════════════════════
    var tileLayers = {
        streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }),
        satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Earthstar Geographics',
            maxZoom: 19
        }),
        dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19
        })
    };

    var currentTile = "streets";
    tileLayers.streets.addTo(map);

    document.querySelectorAll(".tile-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var tile = this.getAttribute("data-tile");
            if (tile === currentTile) return;

            map.removeLayer(tileLayers[currentTile]);
            tileLayers[tile].addTo(map);
            currentTile = tile;

            document.querySelectorAll(".tile-btn").forEach(function (b) {
                b.classList.toggle("active", b.getAttribute("data-tile") === tile);
            });
        });
    });

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

    // ═══════════════════════════════════════════════════════
    //  HEATMAP (per-category colors)
    // ═══════════════════════════════════════════════════════
    var heatLayers = {};
    var heatmapActive = false;

    // Each category gets its own gradient from transparent to its color
    var HEAT_GRADIENTS = {
        "crime":       { 0: "rgba(231,76,60,0)",  0.3: "rgba(231,76,60,0.3)",  0.6: "rgba(231,76,60,0.6)",  1: "#e74c3c" },
        "blind-spots": { 0: "rgba(52,152,219,0)",  0.3: "rgba(52,152,219,0.3)",  0.6: "rgba(52,152,219,0.6)",  1: "#3498db" },
        "abandoned":   { 0: "rgba(142,68,173,0)",  0.3: "rgba(142,68,173,0.3)",  0.6: "rgba(142,68,173,0.6)",  1: "#8e44ad" },
        "unlit":       { 0: "rgba(243,156,18,0)",  0.3: "rgba(243,156,18,0.3)",  0.6: "rgba(243,156,18,0.6)",  1: "#f39c12" }
    };

    function buildHeatDataByCategory(cat) {
        return mapPoints
            .filter(function (p) { return p.category === cat; })
            .map(function (p) { return [p.lat, p.lng, 0.7]; });
    }

    function addHeatLayers() {
        Object.keys(CATEGORIES).forEach(function (cat) {
            var data = buildHeatDataByCategory(cat);
            if (data.length === 0) return;
            heatLayers[cat] = L.heatLayer(data, {
                radius: 35,
                blur: 25,
                max: 1.0,
                minOpacity: 0.4,
                gradient: HEAT_GRADIENTS[cat]
            }).addTo(map);
        });
    }

    function removeHeatLayers() {
        Object.keys(heatLayers).forEach(function (cat) {
            map.removeLayer(heatLayers[cat]);
        });
        heatLayers = {};
    }

    function toggleHeatmap() {
        var btn = document.getElementById("heatmap-toggle");
        if (heatmapActive) {
            // Turn off heatmap → show markers
            removeHeatLayers();
            Object.keys(layers).forEach(function (cat) {
                var cb = document.querySelector('[data-filter="' + cat + '"]');
                if (cb && cb.checked) map.addLayer(layers[cat]);
            });
            heatmapActive = false;
            btn.classList.remove("active");
        } else {
            // Turn on heatmap → hide markers
            Object.keys(layers).forEach(function (cat) {
                map.removeLayer(layers[cat]);
            });
            addHeatLayers();
            heatmapActive = true;
            btn.classList.add("active");
        }
    }

    document.getElementById("heatmap-toggle").addEventListener("click", toggleHeatmap);

    function refreshHeatmap() {
        if (!heatmapActive) return;
        removeHeatLayers();
        addHeatLayers();
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
                icon: createMarkerIcon(point.category),
                draggable: isAdmin
            });
            marker._pointData = point;
            marker._pointCategory = point.category;

            marker.on("click", function () {
                openModal(point);
            });

            // Drag & drop (admin only)
            marker.on("dragend", function (e) {
                var newPos = e.target.getLatLng();
                point.lat = Math.round(newPos.lat * 10000) / 10000;
                point.lng = Math.round(newPos.lng * 10000) / 10000;
                savePoint(point);
                showDragToast();
            });

            marker.bindTooltip(loc(point, "address") || loc(point, "title"), {
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
        refreshHeatmap();
    }

    // ── Drag toast ───────────────────────────────────────────
    function showDragToast() {
        var existing = document.querySelector(".drag-toast");
        if (existing) existing.remove();
        var toast = document.createElement("div");
        toast.className = "drag-toast";
        toast.textContent = t("drag_saved");
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 2000);
    }

    // Initial build + live updates from Firebase / localStorage
    onDataChanged(function () {
        buildMarkers();
        checkUrlPoint();
    });

    function refreshTooltips() {
        markers.forEach(function (marker) {
            marker.unbindTooltip();
            marker.bindTooltip(loc(marker._pointData, "address") || loc(marker._pointData, "title"), {
                direction: "top",
                offset: [0, -12],
                className: "marker-tooltip"
            });
        });
    }

    // ── Stats ───────────────────────────────────────────────
    function updateStats() {
        var counts = { "crime": 0, "blind-spots": 0, "abandoned": 0, "unlit": 0 };
        mapPoints.forEach(function (p) { if (counts.hasOwnProperty(p.category)) counts[p.category]++; });

        document.getElementById("count-crime").textContent = counts["crime"];
        document.getElementById("count-blind-spots").textContent = counts["blind-spots"];
        document.getElementById("count-abandoned").textContent = counts["abandoned"];
        document.getElementById("count-unlit").textContent = counts["unlit"];
        document.getElementById("count-total").textContent = mapPoints.length;
    }

    // ── Filter checkboxes ───────────────────────────────────
    document.querySelectorAll("[data-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
            var cat = this.getAttribute("data-filter");
            if (heatmapActive) return; // don't toggle layers in heatmap mode
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
    //  STREET SEARCH (Nominatim geocoder)
    // ═══════════════════════════════════════════════════════
    var searchInput   = document.getElementById("search-street");
    var searchResults = document.getElementById("search-results");
    var searchClear   = document.getElementById("search-clear");
    var searchTimer   = null;
    var searchMarker  = null;

    searchInput.addEventListener("input", function () {
        var q = searchInput.value.trim();
        searchClear.classList.toggle("hidden", q.length === 0);

        clearTimeout(searchTimer);
        if (q.length < 2) {
            searchResults.classList.add("hidden");
            return;
        }

        searchTimer = setTimeout(function () { doSearch(q); }, 400);
    });

    searchClear.addEventListener("click", function () {
        searchInput.value = "";
        searchResults.classList.add("hidden");
        searchClear.classList.add("hidden");
        removeSearchMarker();
    });

    function parseCoords(str) {
        // Match patterns like "47.146437, 51.9359" or "47.146437 51.9359"
        var m = str.match(/^\s*(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)\s*$/);
        if (!m) return null;
        var a = parseFloat(m[1]), b = parseFloat(m[2]);
        if (isNaN(a) || isNaN(b)) return null;
        // Determine which is lat and which is lng based on Atyrau area
        // Lat ~47, Lng ~52
        if (a >= 40 && a <= 56 && b >= 40 && b <= 60) return { lat: a, lng: b };
        if (b >= 40 && b <= 56 && a >= 40 && a <= 60) return { lat: b, lng: a };
        return null;
    }

    function doSearch(query) {
        // Check if input looks like coordinates
        var coords = parseCoords(query);
        if (coords) {
            var label = coords.lat.toFixed(6) + ", " + coords.lng.toFixed(6);
            searchResults.innerHTML = "";
            var div = document.createElement("div");
            div.className = "search-result-item";
            div.innerHTML = label + '<div class="search-result-type">' + t("search_coordinates") + '</div>';
            div.addEventListener("click", function () {
                map.setView([coords.lat, coords.lng], 17);
                placeSearchMarker(coords.lat, coords.lng, label);
                searchResults.classList.add("hidden");
                searchInput.value = label;
            });
            searchResults.appendChild(div);
            searchResults.classList.remove("hidden");
            return;
        }

        searchResults.innerHTML = '<div class="search-loading">' + t("search_loading") + '</div>';
        searchResults.classList.remove("hidden");

        var url = "https://nominatim.openstreetmap.org/search" +
            "?q=" + encodeURIComponent(query + ", Атырау") +
            "&format=json&addressdetails=1&limit=6" +
            "&viewbox=51.30,47.56,52.54,46.65&bounded=1" +
            "&accept-language=" + (currentLang === "kz" ? "kk" : "ru");

        fetch(url, {
            headers: { "Accept": "application/json" }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            renderSearchResults(data);
        })
        .catch(function () {
            searchResults.innerHTML = '<div class="search-no-results">' + t("search_error") + '</div>';
        });
    }

    function renderSearchResults(data) {
        searchResults.innerHTML = "";

        if (!data || data.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">' + t("search_no_results") + '</div>';
            searchResults.classList.remove("hidden");
            return;
        }

        data.forEach(function (item) {
            var div = document.createElement("div");
            div.className = "search-result-item";

            var name = item.display_name || "";
            // Remove ", Атырау облысы, Қазақстан" etc. from the end to shorten
            name = name.replace(/,\s*(Atyrau Region|Атырауская область|Атырау облысы|Kazakhstan|Казахстан|Қазақстан)\s*/gi, "");

            div.innerHTML = name +
                '<div class="search-result-type">' + (item.type || "").replace(/_/g, " ") + '</div>';

            div.addEventListener("click", function () {
                var lat = parseFloat(item.lat);
                var lng = parseFloat(item.lon);
                map.setView([lat, lng], 17);
                placeSearchMarker(lat, lng, name);
                searchResults.classList.add("hidden");
                searchInput.value = name;
            });

            searchResults.appendChild(div);
        });

        searchResults.classList.remove("hidden");
    }

    function placeSearchMarker(lat, lng, label) {
        removeSearchMarker();
        searchMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: "custom-marker",
                html: '<div class="marker-pin search-pin"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(map);
        searchMarker.bindTooltip(label, {
            direction: "top", offset: [0, -14], className: "marker-tooltip", permanent: true
        }).openTooltip();
    }

    function removeSearchMarker() {
        if (searchMarker) {
            map.removeLayer(searchMarker);
            searchMarker = null;
        }
    }

    // Close results on click outside
    document.addEventListener("click", function (e) {
        if (!e.target.closest("#search-bar")) {
            searchResults.classList.add("hidden");
        }
    });

    // Re-open results on focus if there's text
    searchInput.addEventListener("focus", function () {
        if (searchInput.value.trim().length >= 2 && searchResults.children.length > 0) {
            searchResults.classList.remove("hidden");
        }
    });

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
    var modalShareBtn = document.getElementById("modal-share-btn");
    var shareToast    = document.getElementById("share-toast");
    var currentModalPoint = null;

    function openModal(point) {
        currentModalPoint = point;
        modalTitle.textContent = loc(point, "address") || loc(point, "title");
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

        // Hide share toast
        shareToast.classList.add("hidden");

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

    // ── Share point ──────────────────────────────────────────
    modalShareBtn.addEventListener("click", function () {
        if (!currentModalPoint) return;
        var url = window.location.origin + window.location.pathname + "?point=" + currentModalPoint.id;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                showShareToast();
            });
        } else {
            // Fallback for older browsers
            var input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
            showShareToast();
        }
    });

    function showShareToast() {
        shareToast.classList.remove("hidden");
        setTimeout(function () {
            shareToast.classList.add("hidden");
        }, 2500);
    }

    // ── Open point from URL param ────────────────────────────
    var urlPointChecked = false;

    function checkUrlPoint() {
        if (urlPointChecked) return;
        var params = new URLSearchParams(window.location.search);
        var pointId = params.get("point");
        if (!pointId) return;
        var id = parseInt(pointId, 10);
        var point = mapPoints.find(function (p) { return p.id === id; });
        if (point) {
            urlPointChecked = true;
            map.setView([point.lat, point.lng], 17);
            setTimeout(function () { openModal(point); }, 500);
        }
    }

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
            closeSuggestModal();
            closeSuggestionViewModal();
            closeSuggestionsList();
            cancelSuggestPicking();
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

        // Update admin bar hint to include drag info
        var hintEl = adminBar.querySelector("[data-i18n]");
        if (hintEl) {
            hintEl.setAttribute("data-i18n", "admin_bar_hint_drag");
            hintEl.textContent = t("admin_bar_hint_drag");
        }

        // Rebuild markers with draggable: true
        buildMarkers();
    }

    function exitAdmin() {
        isAdmin = false;
        adminBar.classList.add("hidden");
        document.body.classList.remove("admin-mode");
        document.getElementById("admin-toggle-btn").setAttribute("data-i18n", "admin_login");
        document.getElementById("admin-toggle-btn").textContent = t("admin_login");
        map.getContainer().style.cursor = "";

        // Restore admin bar hint
        var hintEl = adminBar.querySelector("[data-i18n]");
        if (hintEl) {
            hintEl.setAttribute("data-i18n", "admin_bar_hint");
            hintEl.textContent = t("admin_bar_hint");
        }

        // Rebuild markers with draggable: false
        buildMarkers();
    }

    document.getElementById("admin-exit-btn").addEventListener("click", exitAdmin);

    // ═══════════════════════════════════════════════════════
    //  CITIZEN FEEDBACK: SUGGEST A POINT
    // ═══════════════════════════════════════════════════════
    var suggestOverlay = document.getElementById("suggest-overlay");
    var suggestCoords  = document.getElementById("suggest-coords");
    var suggestSubmit  = document.getElementById("suggest-submit");
    var suggestBtn     = document.getElementById("suggest-btn");
    var isSuggestPicking = false;
    var suggestLat = 0, suggestLng = 0;
    var suggestCategory = "blind-spots";

    // Gray marker layer for pending suggestions
    var pendingLayer = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false
    });
    map.addLayer(pendingLayer);
    var pendingMarkers = [];

    function createPendingIcon() {
        return L.divIcon({
            className: "custom-marker",
            html: '<div class="marker-pin pending"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }

    function buildPendingMarkers() {
        pendingMarkers.forEach(function (m) { pendingLayer.removeLayer(m); });
        pendingMarkers = [];

        mapSuggestions.forEach(function (s) {
            var marker = L.marker([s.lat, s.lng], {
                icon: createPendingIcon(),
                draggable: false
            });
            marker._suggestionData = s;

            marker.on("click", function () {
                if (isAdmin) {
                    openSuggestionViewModal(s);
                }
            });

            marker.bindTooltip(
                (s.description || "").substring(0, 50) + (s.description && s.description.length > 50 ? "…" : ""),
                { direction: "top", offset: [0, -12], className: "marker-tooltip" }
            );

            pendingLayer.addLayer(marker);
            pendingMarkers.push(marker);
        });

        updatePendingCount();
    }

    function updatePendingCount() {
        var el = document.getElementById("count-pending");
        if (el) el.textContent = mapSuggestions.length;
    }

    onSuggestionsChanged(buildPendingMarkers);

    // Suggest button click → enable map picking mode
    suggestBtn.addEventListener("click", function () {
        if (isSuggestPicking) {
            cancelSuggestPicking();
            return;
        }
        isSuggestPicking = true;
        suggestBtn.classList.add("picking");
        suggestBtn.textContent = t("suggest_pick_location");
        map.getContainer().style.cursor = "crosshair";
        closeMobileSidebar();
    });

    function cancelSuggestPicking() {
        isSuggestPicking = false;
        suggestBtn.classList.remove("picking");
        suggestBtn.textContent = t("suggest_btn");
        if (!isAdmin) map.getContainer().style.cursor = "";
    }

    // Category buttons in suggest form
    document.querySelectorAll("#suggest-cat-selector .cat-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            suggestCategory = this.getAttribute("data-cat");
            document.querySelectorAll("#suggest-cat-selector .cat-btn").forEach(function (b) {
                b.classList.toggle("active", b.getAttribute("data-cat") === suggestCategory);
            });
        });
    });

    function openSuggestModal() {
        suggestCoords.textContent = suggestLat.toFixed(4) + ", " + suggestLng.toFixed(4);
        document.getElementById("suggest-name").value = "";
        document.getElementById("suggest-contact").value = "";
        document.getElementById("suggest-desc").value = "";
        suggestCategory = "blind-spots";
        document.querySelectorAll("#suggest-cat-selector .cat-btn").forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-cat") === "blind-spots");
        });
        suggestSubmit.disabled = false;
        suggestOverlay.classList.remove("hidden");
    }

    function closeSuggestModal() {
        suggestOverlay.classList.add("hidden");
    }

    document.getElementById("suggest-close").addEventListener("click", closeSuggestModal);
    suggestOverlay.addEventListener("click", function (e) {
        if (e.target === suggestOverlay) closeSuggestModal();
    });

    // Submit suggestion
    suggestSubmit.addEventListener("click", function () {
        var name = document.getElementById("suggest-name").value.trim();
        var contact = document.getElementById("suggest-contact").value.trim();
        var desc = document.getElementById("suggest-desc").value.trim();

        if (!name) { document.getElementById("suggest-name").focus(); return; }
        if (!contact) { document.getElementById("suggest-contact").focus(); return; }
        if (!desc) { document.getElementById("suggest-desc").focus(); return; }

        var suggestion = {
            id: getNextSuggestionId(),
            lat: suggestLat,
            lng: suggestLng,
            category: suggestCategory,
            name: name,
            contact: contact,
            description: desc,
            created: new Date().toISOString()
        };

        saveSuggestion(suggestion);
        closeSuggestModal();

        // Show success toast
        var toast = document.createElement("div");
        toast.className = "suggest-toast";
        toast.textContent = t("suggest_success");
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 3500);
    });

    // ── Admin: View & approve suggestion ─────────────────────
    var suggViewOverlay = document.getElementById("suggestion-view-overlay");
    var suggViewTitle   = document.getElementById("suggestion-view-title");
    var suggViewBadge   = document.getElementById("suggestion-view-badge");
    var suggViewInfo    = document.getElementById("suggestion-view-info");
    var suggViewDesc    = document.getElementById("suggestion-view-desc");
    var suggApproveSection = document.getElementById("suggestion-approve-section");
    var suggPhotoPicker = document.getElementById("suggestion-photo-picker");
    var currentSuggestion = null;
    var suggestionSelectedPhotos = [];

    function openSuggestionViewModal(s) {
        currentSuggestion = s;
        suggestionSelectedPhotos = [];

        suggViewTitle.textContent = t("suggest_pending") + " #" + s.id;

        var catInfo = CATEGORIES[s.category];
        if (catInfo) {
            suggViewBadge.textContent = t(catInfo.badgeKey);
            suggViewBadge.className = s.category;
        } else {
            suggViewBadge.textContent = s.category;
            suggViewBadge.className = "";
        }

        suggViewInfo.innerHTML =
            "<strong>" + t("suggest_from") + "</strong> " + escapeHtml(s.name) + "<br>" +
            "<strong>" + t("suggest_contact_label") + "</strong> " + escapeHtml(s.contact) + "<br>" +
            "<strong>" + s.lat.toFixed(4) + ", " + s.lng.toFixed(4) + "</strong>";

        suggViewDesc.textContent = s.description || "";

        // Build photo picker for approval
        if (isAdmin) {
            suggApproveSection.classList.remove("hidden");
            buildSuggestionPhotoPicker(s.category);
        } else {
            suggApproveSection.classList.add("hidden");
        }

        suggViewOverlay.classList.remove("hidden");
    }

    function closeSuggestionViewModal() {
        suggViewOverlay.classList.add("hidden");
        currentSuggestion = null;
    }

    document.getElementById("suggestion-view-close").addEventListener("click", closeSuggestionViewModal);
    suggViewOverlay.addEventListener("click", function (e) {
        if (e.target === suggViewOverlay) closeSuggestionViewModal();
    });

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function buildSuggestionPhotoPicker(category) {
        suggPhotoPicker.innerHTML = "";
        suggestionSelectedPhotos = [];

        var usedPhotos = getUsedPhotos();
        var filtered = AVAILABLE_PHOTOS.filter(function (photo) {
            return photo.category === category;
        });

        filtered.forEach(function (photo) {
            var item = document.createElement("label");
            item.className = "photo-pick-item";
            if (usedPhotos[photo.file]) item.classList.add("used");

            var checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = photo.file;
            checkbox.addEventListener("change", function () {
                if (this.checked) {
                    suggestionSelectedPhotos.push(photo.file);
                    item.classList.add("selected");
                } else {
                    suggestionSelectedPhotos = suggestionSelectedPhotos.filter(function (f) { return f !== photo.file; });
                    item.classList.remove("selected");
                }
            });

            var thumb = document.createElement("img");
            thumb.src = photo.file;
            thumb.alt = currentLang === "kz" ? photo.label_kz : photo.label_ru;
            thumb.loading = "lazy";

            var label = document.createElement("span");
            label.className = "photo-pick-label";
            var labelText = currentLang === "kz" ? photo.label_kz : photo.label_ru;
            if (usedPhotos[photo.file]) labelText += " ✓";
            label.textContent = labelText;

            item.appendChild(checkbox);
            item.appendChild(thumb);
            item.appendChild(label);
            suggPhotoPicker.appendChild(item);
        });

        if (filtered.length === 0) {
            var empty = document.createElement("p");
            empty.style.cssText = "color:#8892b0;font-size:13px;padding:8px 0;";
            empty.textContent = currentLang === "kz"
                ? "Бұл санат үшін фото жоқ"
                : "Нет фото для этой категории";
            suggPhotoPicker.appendChild(empty);
        }
    }

    // Approve suggestion → create real point + delete suggestion
    document.getElementById("suggestion-approve-btn").addEventListener("click", function () {
        if (!currentSuggestion) return;

        if (suggestionSelectedPhotos.length === 0) {
            alert(t("suggest_approve_photos"));
            return;
        }

        var s = currentSuggestion;
        var newPoint = {
            id: getNextId(),
            lat: s.lat,
            lng: s.lng,
            category: s.category,
            title_ru: s.description.substring(0, 60),
            title_kz: s.description.substring(0, 60),
            address_ru: s.description.substring(0, 60),
            address_kz: s.description.substring(0, 60),
            description_ru: s.description + "\n\n" + t("suggest_from") + " " + s.name + " (" + s.contact + ")",
            description_kz: s.description + "\n\n" + t("suggest_from") + " " + s.name + " (" + s.contact + ")",
            photos: suggestionSelectedPhotos.slice()
        };

        savePoint(newPoint);
        deleteSuggestion(s.id);
        closeSuggestionViewModal();
    });

    // Reject suggestion → delete
    document.getElementById("suggestion-reject-btn").addEventListener("click", function () {
        if (!currentSuggestion) return;
        if (!confirm(t("suggest_confirm_reject"))) return;
        deleteSuggestion(currentSuggestion.id);
        closeSuggestionViewModal();
    });

    // ═══════════════════════════════════════════════════════
    //  ADMIN: SUGGESTIONS LIST
    // ═══════════════════════════════════════════════════════
    var suggestionsListOverlay = document.getElementById("suggestions-list-overlay");
    var suggestionsListEl = document.getElementById("suggestions-list");
    var adminSuggestionsBtn = document.getElementById("admin-suggestions-btn");
    var adminPendingCount = document.getElementById("admin-pending-count");

    function updateAdminPendingCount() {
        if (adminPendingCount) adminPendingCount.textContent = mapSuggestions.length;
    }

    onSuggestionsChanged(updateAdminPendingCount);

    adminSuggestionsBtn.addEventListener("click", function () {
        openSuggestionsList();
    });

    function openSuggestionsList() {
        buildSuggestionsList();
        suggestionsListOverlay.classList.remove("hidden");
    }

    function closeSuggestionsList() {
        suggestionsListOverlay.classList.add("hidden");
    }

    document.getElementById("suggestions-list-close").addEventListener("click", closeSuggestionsList);
    suggestionsListOverlay.addEventListener("click", function (e) {
        if (e.target === suggestionsListOverlay) closeSuggestionsList();
    });

    function buildSuggestionsList() {
        suggestionsListEl.innerHTML = "";

        if (mapSuggestions.length === 0) {
            var empty = document.createElement("div");
            empty.className = "suggestions-empty";
            empty.textContent = t("suggest_no_pending");
            suggestionsListEl.appendChild(empty);
            return;
        }

        // Sort by date (newest first)
        var sorted = mapSuggestions.slice().sort(function (a, b) {
            return (b.created || "").localeCompare(a.created || "");
        });

        sorted.forEach(function (s) {
            var item = document.createElement("div");
            item.className = "suggestion-list-item";

            var catInfo = CATEGORIES[s.category] || { color: "#9e9e9e", badgeKey: s.category };
            var catLabel = t(catInfo.badgeKey);
            var dateStr = s.created ? new Date(s.created).toLocaleDateString(currentLang === "kz" ? "kk-KZ" : "ru-RU") : "";

            item.innerHTML =
                '<div class="suggestion-list-header">' +
                    '<span class="legend-dot" style="background:' + catInfo.color + ';"></span>' +
                    '<span class="suggestion-list-cat">' + escapeHtml(catLabel) + '</span>' +
                    '<span class="suggestion-list-date">' + dateStr + '</span>' +
                '</div>' +
                '<div class="suggestion-list-desc">' + escapeHtml(s.description || "") + '</div>' +
                '<div class="suggestion-list-meta">' +
                    '<strong>' + t("suggest_from") + '</strong> ' + escapeHtml(s.name || "") +
                    ' &middot; <strong>' + t("suggest_contact_label") + '</strong> ' + escapeHtml(s.contact || "") +
                '</div>' +
                '<div class="suggestion-list-actions">' +
                    '<button class="sla-map-btn">' + t("suggest_show_on_map") + '</button>' +
                    '<button class="sla-approve-btn">' + t("suggest_approve") + '</button>' +
                    '<button class="sla-reject-btn">' + t("suggest_reject") + '</button>' +
                '</div>';

            // "На карте" button → zoom to suggestion + open view modal
            item.querySelector(".sla-map-btn").addEventListener("click", function () {
                closeSuggestionsList();
                map.setView([s.lat, s.lng], 17);
                setTimeout(function () { openSuggestionViewModal(s); }, 400);
            });

            // "Одобрить" → zoom to suggestion + open view modal (with photo picker)
            item.querySelector(".sla-approve-btn").addEventListener("click", function () {
                closeSuggestionsList();
                map.setView([s.lat, s.lng], 17);
                setTimeout(function () { openSuggestionViewModal(s); }, 400);
            });

            // "Отклонить" → reject directly
            item.querySelector(".sla-reject-btn").addEventListener("click", function () {
                if (!confirm(t("suggest_confirm_reject"))) return;
                deleteSuggestion(s.id);
                buildSuggestionsList(); // rebuild list
            });

            suggestionsListEl.appendChild(item);
        });
    }

    // ═══════════════════════════════════════════════════════
    //  ADMIN: ADD POINT (click on map)
    // ═══════════════════════════════════════════════════════
    var addOverlay = document.getElementById("add-overlay");
    var addCoords  = document.getElementById("add-coords");
    var pendingLat = 0, pendingLng = 0;
    var selectedCategory = "blind-spots";
    var selectedPhotos = [];

    // Map click → citizen suggest pick OR admin add
    map.on("click", function (e) {
        if (isSuggestPicking) {
            suggestLat = Math.round(e.latlng.lat * 10000) / 10000;
            suggestLng = Math.round(e.latlng.lng * 10000) / 10000;
            cancelSuggestPicking();
            openSuggestModal();
            return;
        }
        if (!isAdmin) return;
        pendingLat = Math.round(e.latlng.lat * 10000) / 10000;
        pendingLng = Math.round(e.latlng.lng * 10000) / 10000;
        openAddModal();
    });

    function openAddModal() {
        addCoords.textContent = pendingLat.toFixed(4) + ", " + pendingLng.toFixed(4);

        // Reset form
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
            photoSection.style.display = selectedCategory === "crime" ? "none" : "";
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
    function getUsedPhotos() {
        var used = {};
        mapPoints.forEach(function (p) {
            (p.photos || []).forEach(function (f) { used[f] = true; });
        });
        return used;
    }

    function buildPhotoPicker() {
        var container = document.getElementById("photo-picker");
        container.innerHTML = "";
        selectedPhotos = [];

        var usedPhotos = getUsedPhotos();

        // Filter photos by selected category
        var filtered = AVAILABLE_PHOTOS.filter(function (photo) {
            return photo.category === selectedCategory;
        });

        filtered.forEach(function (photo) {
            var item = document.createElement("label");
            item.className = "photo-pick-item";
            if (usedPhotos[photo.file]) {
                item.classList.add("used");
            }

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
            var labelText = currentLang === "kz" ? photo.label_kz : photo.label_ru;
            if (usedPhotos[photo.file]) {
                labelText += " ✓";
            }
            label.textContent = labelText;

            item.appendChild(checkbox);
            item.appendChild(thumb);
            item.appendChild(label);
            container.appendChild(item);
        });

        if (filtered.length === 0) {
            var empty = document.createElement("p");
            empty.style.cssText = "color:#8892b0;font-size:13px;padding:8px 0;";
            empty.textContent = currentLang === "kz"
                ? "Бұл санат үшін фото жоқ"
                : "Нет фото для этой категории";
            container.appendChild(empty);
        }
    }

    // ── Submit new point ────────────────────────────────────
    document.getElementById("add-submit").addEventListener("click", function () {
        var addressRu = document.getElementById("add-address-ru").value.trim();
        if (!addressRu) {
            document.getElementById("add-address-ru").focus();
            return;
        }

        var addressKz = document.getElementById("add-address-kz").value.trim() || addressRu;

        var newPoint = {
            id: getNextId(),
            lat: pendingLat,
            lng: pendingLng,
            category: selectedCategory,
            title_ru: addressRu,
            title_kz: addressKz,
            address_ru: addressRu,
            address_kz: addressKz,
            description_ru: document.getElementById("add-desc-ru").value.trim(),
            description_kz: document.getElementById("add-desc-kz").value.trim(),
            photos: selectedCategory === "crime" ? [] : selectedPhotos.slice()
        };

        savePoint(newPoint);
        closeAddModal();
    });

})();
