(function () {
    "use strict";

    // ── Markdown to HTML ───────────────────────────────────
    function markdownToHtml(md) {
        // Escape HTML
        var html = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Headers
        html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
        html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
        html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        // Italic
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        // Horizontal rule
        html = html.replace(/^---$/gm, "<hr>");
        // Bullet lists: group consecutive lines starting with "- "
        html = html.replace(/(^- .+$(\n|$))+/gm, function (block) {
            var items = block.trim().split("\n").map(function (line) {
                return "<li>" + line.replace(/^- /, "") + "</li>";
            }).join("");
            return "<ul>" + items + "</ul>\n";
        });
        // Numbered lists: group consecutive lines starting with "N. "
        html = html.replace(/(^\d+\. .+$(\n|$))+/gm, function (block) {
            var items = block.trim().split("\n").map(function (line) {
                return "<li>" + line.replace(/^\d+\. /, "") + "</li>";
            }).join("");
            return "<ol>" + items + "</ol>\n";
        });
        // Paragraphs: wrap remaining non-tag lines
        html = html.replace(/^(?!<[houl])(.*\S.*)$/gm, function (m, p1) {
            return "<p>" + p1 + "</p>";
        });
        // Clean up extra newlines
        html = html.replace(/\n{2,}/g, "\n");
        return html.trim();
    }

    // ── Config ──────────────────────────────────────────────
    var ADMIN_PASSWORD = "prokuratura2025";
    var STAFF_PASSWORD = "1345";
    var AKIMAT_PASSWORD = "aa123";

    var CATEGORIES = {
        "crime":       { color: "#e74c3c", badgeKey: "badge_crime" },
        "blind-spots": { color: "#3498db", badgeKey: "badge_blind" },
        "abandoned":   { color: "#8e44ad", badgeKey: "badge_abandoned" },
        "unlit":       { color: "#f39c12", badgeKey: "badge_unlit" }
    };

    var isAdmin = false;
    var isStaff = false;
    var isAkimat = false;

    // ── Helper: localized field ─────────────────────────────
    function loc(point, field) {
        return point[field + "_" + currentLang] || point[field + "_ru"] || "";
    }

    // ── Map init ────────────────────────────────────────────
    // Atyrau center + ~50 km bounding box
    // Статьи, скрытые с карты (но остаются в списке и аналитике)
    var HIDDEN_MAP_ARTICLES = {590:1, 593:1, 230:1, 610:1, 615:1, 591:1, 601:1, 437:1, 597:1, 139:1, 172:1, 189:1, 190:1, 195:1, 232:1, 299:1, 385:1, 185:1};

    function _isHiddenArticle(article) {
        if (!article) return false;
        var m = article.match(/(\d{2,4})/);
        return m ? !!HIDDEN_MAP_ARTICLES[parseInt(m[1], 10)] : false;
    }

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
        maxBoundsViscosity: 1.0,
        preferCanvas: true,
        renderer: L.canvas({ tolerance: 12 })
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

    function createClusterIcon(cat) {
        var color = CATEGORIES[cat].color;
        return function (cluster) {
            var count = cluster.getChildCount();
            var size = count < 10 ? 36 : count < 50 ? 44 : 52;
            return L.divIcon({
                html: '<div style="background:' + color + ';width:' + (size - 10) + 'px;height:' + (size - 10) + 'px;' +
                    'border-radius:50%;display:flex;align-items:center;justify-content:center;' +
                    'color:#fff;font-weight:700;font-size:12px;">' + count + '</div>',
                className: 'cat-cluster cat-cluster-' + cat,
                iconSize: L.point(size, size)
            });
        };
    }

    Object.keys(CATEGORIES).forEach(function (cat) {
        layers[cat] = L.markerClusterGroup({
            maxClusterRadius: 40,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: createClusterIcon(cat)
        });
        // Преступность — только из ЕРДР (отдельный слой), остальные — из Firebase
        if (cat !== "crime") {
            map.addLayer(layers[cat]);
        }
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

    // Each category gets its own smooth gradient
    var HEAT_GRADIENTS = {
        "crime":       { 0: "rgba(231,76,60,0)", 0.2: "rgba(231,76,60,0.15)", 0.4: "rgba(231,76,60,0.35)", 0.7: "rgba(255,100,80,0.6)", 1: "#e74c3c" },
        "blind-spots": { 0: "rgba(52,152,219,0)", 0.2: "rgba(52,152,219,0.15)", 0.4: "rgba(52,152,219,0.35)", 0.7: "rgba(80,180,255,0.6)", 1: "#3498db" },
        "abandoned":   { 0: "rgba(142,68,173,0)", 0.2: "rgba(142,68,173,0.15)", 0.4: "rgba(142,68,173,0.35)", 0.7: "rgba(170,100,210,0.6)", 1: "#8e44ad" },
        "unlit":       { 0: "rgba(243,156,18,0)", 0.2: "rgba(243,156,18,0.15)", 0.4: "rgba(243,156,18,0.35)", 0.7: "rgba(255,180,50,0.6)", 1: "#f39c12" }
    };

    function buildHeatDataByCategory(cat) {
        if (cat === "crime") {
            return crimeIncidents
                .filter(function (c) { return typeof c.lat === "number" && !isNaN(c.lat); })
                .map(function (c) { return [c.lat, c.lng, 0.6]; });
        }
        return mapPoints
            .filter(function (p) { return p.category === cat; })
            .map(function (p) { return [p.lat, p.lng, 0.6]; });
    }

    function addHeatLayers() {
        Object.keys(CATEGORIES).forEach(function (cat) {
            var data = buildHeatDataByCategory(cat);
            if (data.length === 0) return;
            heatLayers[cat] = L.heatLayer(data, {
                radius: 28,
                blur: 18,
                max: 1.0,
                minOpacity: 0.25,
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
                if (cb && cb.checked) {
                    if (cat === "crime") {
                        map.addLayer(crimeErdrLayer);
                    } else {
                        map.addLayer(layers[cat]);
                    }
                }
            });
            // Restore cameras, police, AV
            var avCb = document.querySelector('[data-filter="admin-violations"]');
            if (avCb && avCb.checked && isStaff) map.addLayer(avLayer);
            var camCb = document.querySelector('[data-filter="cameras"]');
            if (camCb && camCb.checked && isStaff) map.addLayer(cameraLayer);
            var polCb = document.querySelector('[data-filter="police"]');
            if (polCb && polCb.checked) map.addLayer(policeLayer);
            var schCb = document.querySelector('[data-filter="schools"]');
            if (schCb && schCb.checked) map.addLayer(schoolLayer);
            heatmapActive = false;
            btn.classList.remove("active");
        } else {
            // Turn on heatmap → hide markers
            Object.keys(layers).forEach(function (cat) {
                map.removeLayer(layers[cat]);
            });
            map.removeLayer(crimeErdrLayer);
            map.removeLayer(avLayer);
            map.removeLayer(cameraLayer);
            map.removeLayer(policeLayer);
            map.removeLayer(schoolLayer);
            addHeatLayers();
            heatmapActive = true;
            btn.classList.add("active");
        }
    }

    document.getElementById("heatmap-toggle").addEventListener("click", toggleHeatmap);

    // ═══════════════════════════════════════════════════════
    //  360° PANORAMA (Google Street View)
    // ═══════════════════════════════════════════════════════
    var panoramaMode = false;
    var panoramaBtn = document.getElementById("panorama-toggle");

    function openPanorama(lat, lng) {
        var mapsUrl = "https://www.google.com/maps/@" + lat + "," + lng + ",3a,75y,0h,90t/data=!3m4!1e1!3m2!1s!2e0";
        window.open(mapsUrl, "_blank");
    }

    panoramaBtn.addEventListener("click", function () {
        panoramaMode = !panoramaMode;
        panoramaBtn.classList.toggle("active", panoramaMode);
        document.getElementById("map").classList.toggle("panorama-mode", panoramaMode);
    });

    map.on("click", function (e) {
        if (!panoramaMode) return;
        openPanorama(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
        // Выключить режим панорамы после клика
        panoramaMode = false;
        panoramaBtn.classList.remove("active");
        document.getElementById("map").classList.remove("panorama-mode");
    });

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

        // Преступность — количество из ЕРДР с координатами (на карте)
        var crimeOnMap = crimeIncidents.filter(function (c) {
            return typeof c.lat === "number" && !isNaN(c.lat);
        }).length;
        document.getElementById("count-crime").textContent = crimeOnMap;
        document.getElementById("count-blind-spots").textContent = counts["blind-spots"];
        document.getElementById("count-abandoned").textContent = counts["abandoned"];
        document.getElementById("count-unlit").textContent = counts["unlit"];
        var avOnMap = adminViolations.filter(function (v) { return v.lat !== null; }).length;
        document.getElementById("count-av").textContent = avOnMap;
        document.getElementById("count-cameras").textContent = cameraPoints.length;
        document.getElementById("count-police").textContent = policePoints.length;
        document.getElementById("count-schools").textContent = schoolPoints.length;
        document.getElementById("count-total").textContent = crimeOnMap + avOnMap + counts["blind-spots"] + counts["abandoned"] + counts["unlit"] + cameraPoints.length + policePoints.length + schoolPoints.length;
    }

    // ── Filter checkboxes ───────────────────────────────────
    document.querySelectorAll("[data-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
            var cat = this.getAttribute("data-filter");
            if (heatmapActive) return; // don't toggle layers in heatmap mode
            if (cat === "crime") {
                if (this.checked) map.addLayer(crimeErdrLayer);
                else map.removeLayer(crimeErdrLayer);
            } else if (cat === "admin-violations") {
                if (this.checked) map.addLayer(avLayer);
                else map.removeLayer(avLayer);
            } else if (cat === "cameras") {
                if (this.checked) map.addLayer(cameraLayer);
                else map.removeLayer(cameraLayer);
            } else if (cat === "police") {
                if (this.checked) map.addLayer(policeLayer);
                else map.removeLayer(policeLayer);
            } else if (cat === "schools") {
                if (this.checked) map.addLayer(schoolLayer);
                else map.removeLayer(schoolLayer);
            } else if (cat === "venues") {
                if (this.checked) map.addLayer(venueLayer);
                else map.removeLayer(venueLayer);
            } else {
                if (this.checked) map.addLayer(layers[cat]);
                else map.removeLayer(layers[cat]);
            }
        });
    });

    // ═══════════════════════════════════════════════════════
    //  CRIME INCIDENTS (ЕРДР) — full panel view
    // ═══════════════════════════════════════════════════════
    var currentCrimePeriod = "all";
    var crimeSearchQuery = "";
    var crimeFilterArticle = "";
    var crimeFilterOrgan = "";
    var crimeFilterPlace = "";
    var crimeFilterPublic = "";
    var crimeSortMode = "date-desc";

    /**
     * Заполнить выпадающие списки фильтров уникальными значениями.
     */
    function populateCrimeFilters() {
        var articles = {}, organs = {}, places = {};

        crimeIncidents.forEach(function (c) {
            if (c.article) articles[c.article] = true;
            if (c.organ) organs[c.organ] = true;
            if (c.placeType) places[c.placeType] = true;
        });

        _fillSelect("crime-filter-article", articles, "Все статьи");
        _fillSelect("crime-filter-organ", organs, "Все органы");
        _fillSelect("crime-filter-place", places, "Все");
    }

    function _fillSelect(id, valuesObj, defaultLabel) {
        var el = document.getElementById(id);
        if (!el) return;
        var current = el.value;
        el.innerHTML = '<option value="">' + defaultLabel + '</option>';
        Object.keys(valuesObj).sort().forEach(function (v) {
            var opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
            el.appendChild(opt);
        });
        el.value = current;
    }

    /**
     * Обновить карточки статистики.
     */
    function updateCrimeStats() {
        var all = filterCrimesByPeriod(currentCrimePeriod);
        var total = all.length;
        var publicCount = all.filter(function (c) { return c.isPublic; }).length;
        var withCoords = all.filter(function (c) {
            return typeof c.lat === "number" && !isNaN(c.lat);
        }).length;
        var articleSet = {};
        all.forEach(function (c) { if (c.article) articleSet[extractArticleNumber(c.article)] = true; });
        var uniqueArticles = Object.keys(articleSet).length;

        _setText("cs-total", total);
        _setText("cs-public", publicCount);
        _setText("cs-coords", withCoords);
        _setText("cs-articles", uniqueArticles);
    }

    function _setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    /**
     * Получить отфильтрованный и отсортированный список.
     */
    function getFilteredCrimes() {
        var list = filterCrimesByPeriod(currentCrimePeriod);

        // Фильтр по статье
        if (crimeFilterArticle) {
            list = list.filter(function (c) { return c.article === crimeFilterArticle; });
        }
        // Фильтр по органу
        if (crimeFilterOrgan) {
            list = list.filter(function (c) { return c.organ === crimeFilterOrgan; });
        }
        // Фильтр по месту
        if (crimeFilterPlace) {
            list = list.filter(function (c) { return c.placeType === crimeFilterPlace; });
        }
        // Фильтр по общественному месту
        if (crimeFilterPublic === "yes") {
            list = list.filter(function (c) { return c.isPublic; });
        } else if (crimeFilterPublic === "no") {
            list = list.filter(function (c) { return !c.isPublic; });
        }
        // Текстовый поиск
        if (crimeSearchQuery) {
            var q = crimeSearchQuery.toLowerCase();
            list = list.filter(function (c) {
                return (c.article || "").toLowerCase().indexOf(q) !== -1 ||
                       (c.street || "").toLowerCase().indexOf(q) !== -1 ||
                       (c.city || "").toLowerCase().indexOf(q) !== -1 ||
                       (c.description || "").toLowerCase().indexOf(q) !== -1 ||
                       (c.organ || "").toLowerCase().indexOf(q) !== -1 ||
                       (c.erdr || "").toString().indexOf(q) !== -1 ||
                       buildCrimeAddress(c).toLowerCase().indexOf(q) !== -1;
            });
        }
        // Сортировка
        list.sort(function (a, b) {
            switch (crimeSortMode) {
                case "date-asc":
                    return (a.regDate || "").localeCompare(b.regDate || "");
                case "article":
                    return (a.article || "").localeCompare(b.article || "");
                default: // date-desc
                    return (b.regDate || "").localeCompare(a.regDate || "");
            }
        });

        return list;
    }

    /**
     * Построить список правонарушений в панели.
     */
    function buildCrimeList() {
        var listEl = document.getElementById("crime-list");
        if (!listEl) return;
        listEl.innerHTML = "";

        var filtered = getFilteredCrimes();

        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="crime-list-empty">Нет данных по выбранным фильтрам</div>';
        }

        filtered.forEach(function (crime) {
            var item = document.createElement("div");
            item.className = "crime-list-item";

            var dateStr = formatCrimeDate(crime.regDate);
            var address = buildCrimeAddress(crime);
            var desc = (crime.description || "").substring(0, 200);
            var placeBadge = "";
            if (crime.placeType) {
                var cls = crime.isPublic ? "crime-list-place-badge public" : "crime-list-place-badge";
                placeBadge = '<span class="' + cls + '">' + crime.placeType +
                    (crime.isPublic ? " (общ.)" : "") + '</span>';
            }

            item.innerHTML =
                '<div class="crime-list-item-header">' +
                    '<span class="crime-list-article">' + (crime.article || "—") +
                        (crime.articlePart ? " " + crime.articlePart : "") + '</span>' +
                    '<span class="crime-list-date">' + dateStr + '</span>' +
                '</div>' +
                '<div class="crime-list-erdr">ЕРДР: ' + (crime.erdr || "—") + '</div>' +
                '<div class="crime-list-address">' + (address || "—") + '</div>' +
                '<div class="crime-list-organ">' + (crime.organ || "") + '</div>' +
                placeBadge +
                (desc ? '<div class="crime-list-description">' + desc + '</div>' : '');

            item.addEventListener("click", function () {
                openCrimeModal(crime);
            });

            listEl.appendChild(item);
        });

        // Обновить счётчики
        var panelCount = document.getElementById("crime-panel-count-value");
        if (panelCount) panelCount.textContent = filtered.length;
    }

    // ── Подсказка дат для периода ──────────────────────────
    var MONTHS_RU = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    var MONTHS_RU_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    function _pad2(n) { return n < 10 ? "0" + n : "" + n; }
    function _fmtDate(d) { return d.getDate() + " " + MONTHS_RU[d.getMonth()] + " " + d.getFullYear(); }

    function getPeriodHint(period) {
        if (period === "all") return "";
        var now = new Date();
        if (period === "day") {
            var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            return _fmtDate(yesterday);
        }
        if (period === "week") {
            var day = now.getDay();
            var diff = (day === 0) ? 6 : day - 1;
            var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
            return _fmtDate(monday) + " — " + _fmtDate(now);
        }
        if (period === "month") {
            return MONTHS_RU_NOM[now.getMonth()] + " " + now.getFullYear();
        }
        if (period === "quarter") {
            var qMonth = Math.floor(now.getMonth() / 3) * 3;
            return MONTHS_RU_NOM[qMonth] + " — " + MONTHS_RU_NOM[qMonth + 2] + " " + now.getFullYear();
        }
        if (period === "year") {
            return now.getFullYear() + " год";
        }
        return "";
    }

    function updatePeriodHint(hintId, period) {
        var el = document.getElementById(hintId);
        if (el) el.textContent = getPeriodHint(period);
    }

    // ── Filter event listeners ────────────────────────────
    document.querySelectorAll(".crime-period-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            this.parentElement.querySelectorAll(".crime-period-btn").forEach(function (b) {
                b.classList.remove("active");
            });
            this.classList.add("active");
            currentCrimePeriod = this.getAttribute("data-period");
            updatePeriodHint("crime-period-hint", currentCrimePeriod);
            updateCrimeStats();
            buildCrimeList();
        });
    });

    var crimeSearchInput = document.getElementById("crime-search-input");
    if (crimeSearchInput) {
        var _searchTimer;
        crimeSearchInput.addEventListener("input", function () {
            var self = this;
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(function () {
                crimeSearchQuery = self.value.trim();
                buildCrimeList();
            }, 200);
        });
    }

    ["crime-filter-article", "crime-filter-organ", "crime-filter-place", "crime-filter-public", "crime-sort"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", function () {
            switch (id) {
                case "crime-filter-article": crimeFilterArticle = this.value; break;
                case "crime-filter-organ":   crimeFilterOrgan = this.value; break;
                case "crime-filter-place":   crimeFilterPlace = this.value; break;
                case "crime-filter-public":  crimeFilterPublic = this.value; break;
                case "crime-sort":           crimeSortMode = this.value; break;
            }
            buildCrimeList();
        });
    });

    // Сброс фильтров
    var resetBtn = document.getElementById("crime-reset-filters");
    if (resetBtn) {
        resetBtn.addEventListener("click", function () {
            crimeSearchQuery = "";
            crimeFilterArticle = "";
            crimeFilterOrgan = "";
            crimeFilterPlace = "";
            crimeFilterPublic = "";
            crimeSortMode = "date-desc";
            currentCrimePeriod = "all";

            if (crimeSearchInput) crimeSearchInput.value = "";
            ["crime-filter-article", "crime-filter-organ", "crime-filter-place", "crime-filter-public"].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.value = "";
            });
            var sortEl = document.getElementById("crime-sort");
            if (sortEl) sortEl.value = "date-desc";

            document.querySelectorAll(".crime-period-btn").forEach(function (b) {
                b.classList.remove("active");
                if (b.getAttribute("data-period") === "all") b.classList.add("active");
            });

            buildCrimeList();
        });
    }

    // ── Переключение Карта ↔ ЕРДР панель ──────────────────
    var crimePanel = document.getElementById("crime-panel");
    var mapEl = document.getElementById("map");
    var searchBar = document.getElementById("search-bar");
    var mapControls = document.getElementById("map-controls");

    function showCrimePanel() {
        mapEl.classList.add("hidden");
        if (searchBar) searchBar.classList.add("hidden");
        if (mapControls) mapControls.classList.add("hidden");
        crimePanel.classList.remove("hidden");
        populateCrimeFilters();
        updateCrimeStats();
        buildCrimeList();
        // Закрыть мобильное меню
        var sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("open");
        var overlay = document.getElementById("sidebar-overlay");
        if (overlay) overlay.classList.remove("active");
    }

    function hideCrimePanel() {
        crimePanel.classList.add("hidden");
        mapEl.classList.remove("hidden");
        if (searchBar) searchBar.classList.remove("hidden");
        if (mapControls) mapControls.classList.remove("hidden");
        map.invalidateSize();
    }

    // ── Отчет → Report Selector ─────────────────────────────
    var reportSelector = document.getElementById("report-selector");

    function showReportSelector() {
        mapEl.classList.add("hidden");
        if (searchBar) searchBar.classList.add("hidden");
        if (mapControls) mapControls.classList.add("hidden");
        reportSelector.classList.remove("hidden");
        document.getElementById("report-count-erdr").textContent = crimeIncidents.length + " записей";
        document.getElementById("report-count-av").textContent = adminViolations.length + " записей";
        var sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("open");
        var ol = document.getElementById("sidebar-overlay");
        if (ol) ol.classList.remove("active");
    }

    function hideReportSelector() {
        reportSelector.classList.add("hidden");
        mapEl.classList.remove("hidden");
        if (searchBar) searchBar.classList.remove("hidden");
        if (mapControls) mapControls.classList.remove("hidden");
        map.invalidateSize();
    }

    var openBtn = document.getElementById("open-crime-panel-btn");
    if (openBtn) openBtn.addEventListener("click", showReportSelector);

    document.getElementById("close-report-selector").addEventListener("click", hideReportSelector);

    document.getElementById("report-card-erdr").addEventListener("click", function () {
        reportSelector.classList.add("hidden");
        showCrimePanel();
    });

    document.getElementById("report-card-erdr-analytics").addEventListener("click", function () {
        reportSelector.classList.add("hidden");
        showAnalyticsPanel();
    });

    document.getElementById("report-card-av").addEventListener("click", function () {
        reportSelector.classList.add("hidden");
        showAVPanel();
    });

    // Crime panel: back goes to report selector
    var closeBtn = document.getElementById("close-crime-panel");
    if (closeBtn) closeBtn.addEventListener("click", function () {
        hideCrimePanel();
        showReportSelector();
    });

    // ═══════════════════════════════════════════════════════
    //  ANALYTICS PANEL
    // ═══════════════════════════════════════════════════════
    var analyticsPanel = document.getElementById("analytics-panel");
    var zoneCircles = []; // circles on the map

    function showAnalyticsPanel() {
        mapEl.classList.add("hidden");
        crimePanel.classList.add("hidden");
        if (searchBar) searchBar.classList.add("hidden");
        if (mapControls) mapControls.classList.add("hidden");
        analyticsPanel.classList.remove("hidden");
        renderAnalytics();
        var sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("open");
        var ol = document.getElementById("sidebar-overlay");
        if (ol) ol.classList.remove("active");
    }

    function hideAnalyticsPanel() {
        analyticsPanel.classList.add("hidden");
        mapEl.classList.remove("hidden");
        if (searchBar) searchBar.classList.remove("hidden");
        if (mapControls) mapControls.classList.remove("hidden");
        map.invalidateSize();
    }

    var closeAnBtn = document.getElementById("close-analytics");
    if (closeAnBtn) closeAnBtn.addEventListener("click", function () {
        hideAnalyticsPanel();
        showReportSelector();
    });

    // Tabs
    document.querySelectorAll(".analytics-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
            document.querySelectorAll(".analytics-tab").forEach(function (t) { t.classList.remove("active"); });
            document.querySelectorAll(".analytics-tab-content").forEach(function (c) { c.classList.remove("active"); });
            this.classList.add("active");
            var target = this.getAttribute("data-tab");
            var content = document.querySelector('.analytics-tab-content[data-tab="' + target + '"]');
            if (content) content.classList.add("active");
        });
    });

    var analyticsPeriod = "all";

    document.querySelectorAll(".an-period-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".an-period-btn").forEach(function (b) {
                b.classList.remove("active");
            });
            this.classList.add("active");
            analyticsPeriod = this.getAttribute("data-period");
            updatePeriodHint("analytics-period-hint", analyticsPeriod);
            renderAnalytics();
        });
    });

    function renderAnalytics() {
        if (crimeIncidents.length === 0) return;
        var filtered = filterCrimesByPeriod(analyticsPeriod);
        // Фильтруем людей по ЕРДР номерам отфильтрованных преступлений
        var erdrSet = {};
        filtered.forEach(function (c) { if (c.erdr) erdrSet[c.erdr] = true; });
        var filteredPeople = crimePeople.filter(function (p) { return erdrSet[p.erdr]; });
        var analysis = runFullAnalysis(filtered, filteredPeople);

        renderOverviewStats(analysis, filtered);
        renderBarChart("an-articles-chart", analysis.byArticle.slice(0, 15), "red");
        renderMonthsChart(analysis.byMonth);
        renderOrgansChart(filtered);
        renderBarChart("an-method-chart", analysis.byCrimeMethod.slice(0, 10), "orange");
        renderBarChart("an-place-chart", analysis.byPlaceType.slice(0, 10), "green");
        renderHoursChart(analysis.byHour);
        renderDaysChart(analysis.byDayOfWeek);
        renderDangerTimes(analysis);
        renderBarChart("an-streets-chart", (analysis.byGeoZone || []).slice(0, 15), "purple");
        // Фильтруем зоны с аномально большим числом (дополнительная защита)
        var validZones = analysis.problemZones.filter(function (z) { return z.count <= 50; });
        renderZonesList(validZones);

        // Люди
        if (analysis.people) {
            renderPeopleStats(analysis.people);
            renderBarChart("an-people-age-chart", analysis.people.byAge, "blue");
            renderBarChart("an-people-gender-chart", analysis.people.byGender, "green");
            renderBarChart("an-people-education-chart", analysis.people.byEducation, "purple");
            renderBarChart("an-people-occupation-chart", analysis.people.byOccupation.slice(0, 15), "orange");
            renderBarChart("an-people-marital-chart", analysis.people.byMaritalStatus, "blue");
            renderBarChart("an-people-nationality-chart", analysis.people.byNationality.slice(0, 10), "green");
            _initPeopleFilters();
        }

        // Store for AI
        window._lastAnalysis = analysis;

        // ── ИИ Помощник Прокурора (offline brief) ──
        var assistantBody = document.getElementById("assistant-body");
        if (assistantBody && typeof buildProsecutorBriefing === "function") {
            assistantBody.innerHTML = buildProsecutorBriefing(analysis, filtered, currentLang || "ru");
            assistantBody.querySelectorAll("[data-usynu-type]").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var tp = this.getAttribute("data-usynu-type");
                    if (typeof downloadUsynuByType === "function") downloadUsynuByType(tp, analysis);
                });
            });
            // Кнопки "показать на карте" для гео-зон
            assistantBody.querySelectorAll(".an-zone-map-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var lat = parseFloat(this.getAttribute("data-lat"));
                    var lng = parseFloat(this.getAttribute("data-lng"));
                    if (isNaN(lat) || isNaN(lng)) return;
                    // Закрыть аналитику, показать карту
                    hideAnalyticsPanel();
                    setTimeout(function () {
                        map.invalidateSize();
                        map.setView([lat, lng], 15);
                        // Нарисовать круг 500м
                        if (window._geoZoneCircle) { map.removeLayer(window._geoZoneCircle); }
                        window._geoZoneCircle = L.circle([lat, lng], {
                            radius: 500,
                            color: '#e74c3c',
                            fillColor: '#e74c3c',
                            fillOpacity: 0.15,
                            weight: 3,
                            dashArray: '8,6'
                        }).addTo(map);
                        window._geoZoneCircle.bindPopup(
                            '<strong>' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</strong><br>' +
                            'Радиус: 500 м'
                        ).openPopup();
                        // Убрать круг через 60 сек
                        setTimeout(function () {
                            if (window._geoZoneCircle) {
                                map.removeLayer(window._geoZoneCircle);
                                window._geoZoneCircle = null;
                            }
                        }, 60000);
                    }, 100);
                });
            });

            // ── Экспорт кнопки в брифинге ──
            assistantBody.querySelectorAll("[data-export]").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    _handleBriefExport(this.getAttribute("data-export"), analysis);
                });
            });

            // ── Поиск по лицам ──
            var pSearch = document.getElementById("brief-people-search");
            if (pSearch) {
                pSearch.addEventListener("input", function () {
                    var q = this.value.trim().toLowerCase();
                    if (q.length < 2) return;
                    var found = crimePeople.filter(function (p) {
                        var fio = [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ").toLowerCase();
                        return fio.indexOf(q) !== -1 || (p.iin && p.iin.indexOf(q) !== -1);
                    }).slice(0, 30);
                    if (found.length > 0) _showPeopleResults(found);
                });
            }
        }
    }

    function _handleBriefExport(type, a) {
        if (type === "articles") {
            var h = ["#", "Статья", "Кол-во", "Доля %"];
            var r = (a.byArticle || []).map(function (art, i) {
                return [i + 1, art.label, art.count, a.total > 0 ? Math.round(art.count / a.total * 100) : 0];
            });
            _exportXlsx(h, r, "Articles_" + new Date().toISOString().slice(0, 10) + ".xlsx");
        } else if (type === "geozones") {
            var h2 = ["#", "Координаты", "Кол-во", "Осн. статья"];
            var r2 = (a.byGeoZone || []).map(function (z, i) {
                return [i + 1, z.coords, z.count, z.topArticle || ""];
            });
            _exportXlsx(h2, r2, "GeoZones_" + new Date().toISOString().slice(0, 10) + ".xlsx");
        } else if (type === "hotzones") {
            var h3 = ["#", "Lat", "Lng", "Кол-во", "Осн. статья", "Пиковый час", "Уровень"];
            var zones = (a.problemZones || []).filter(function (z) { return z.count <= 50; });
            var r3 = zones.map(function (z, i) {
                return [i + 1, z.lat.toFixed(4), z.lng.toFixed(4), z.count, z.topArticle || "",
                    typeof z.peakHour === "number" ? ("0" + z.peakHour).slice(-2) + ":00" : "", z.dangerLevel];
            });
            _exportXlsx(h3, r3, "HotZones_" + new Date().toISOString().slice(0, 10) + ".xlsx");
        } else if (type === "people") {
            var h4 = ["#", "ФИО", "Возраст", "Пол", "Национальность", "Образование", "Род занятий", "Статья", "ЕРДР"];
            var r4 = crimePeople.map(function (p, i) {
                return [i + 1, [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" "),
                    p.age || "", p.gender || "", p.nationality || "", p.education || "",
                    p.occupation || "", p.article || "", p.erdr || ""];
            });
            _exportXlsx(h4, r4, "People_" + new Date().toISOString().slice(0, 10) + ".xlsx");
        } else if (type === "allpeople") {
            _showPeopleResults(crimePeople.slice(0, 50));
        } else if (type === "showallzones") {
            var zones2 = (a.problemZones || []).filter(function (z) { return z.count <= 50; }).slice(0, 10);
            hideAnalyticsPanel();
            setTimeout(function () {
                map.invalidateSize();
                if (window._hotZoneCircles) window._hotZoneCircles.forEach(function (c) { map.removeLayer(c); });
                window._hotZoneCircles = [];
                var bounds = [];
                zones2.forEach(function (z, i) {
                    var c = L.circle([z.lat, z.lng], {
                        radius: 500, color: '#e74c3c', fillColor: '#e74c3c',
                        fillOpacity: 0.12, weight: 2, dashArray: '6,4'
                    }).addTo(map);
                    c.bindPopup('<strong>#' + (i + 1) + '</strong> — ' + z.count + ' случаев<br>' + z.lat.toFixed(4) + ', ' + z.lng.toFixed(4));
                    window._hotZoneCircles.push(c);
                    bounds.push([z.lat, z.lng]);
                });
                if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
                setTimeout(function () {
                    if (window._hotZoneCircles) window._hotZoneCircles.forEach(function (c2) { map.removeLayer(c2); });
                    window._hotZoneCircles = [];
                }, 60000);
            }, 100);
        }
    }

    // ── People tab filters ──
    var _peopleListenersBound = false;
    function _uniqValues(items, key) {
        var set = {};
        items.forEach(function (p) {
            var v = (p[key] || "").trim();
            if (v) set[v] = (set[v] || 0) + 1;
        });
        return Object.keys(set).sort(function (a, b) { return set[b] - set[a]; });
    }
    function _fillSelectKeep(id, vals) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var prev = sel.value;
        var first = sel.options[0].outerHTML;
        sel.innerHTML = first + vals.map(function (v) {
            return '<option value="' + v.replace(/"/g, "&quot;") + '">' + v + '</option>';
        }).join("");
        if (prev) sel.value = prev;
    }
    function _initPeopleFilters() {
        var people = (typeof crimePeople !== "undefined") ? crimePeople : [];

        // Обновляем селекты каждый раз — могут появиться новые значения
        _fillSelectKeep("an-people-gender-filter", _uniqValues(people, "gender"));
        _fillSelectKeep("an-people-edu-filter", _uniqValues(people, "education"));
        _fillSelectKeep("an-people-occ-filter", _uniqValues(people, "occupation"));

        // Слушатели вешаем один раз
        if (!_peopleListenersBound) {
            _peopleListenersBound = true;
            ["an-people-search", "an-people-age-filter", "an-people-gender-filter",
             "an-people-edu-filter", "an-people-occ-filter"].forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                var ev = el.tagName === "INPUT" ? "input" : "change";
                el.addEventListener(ev, _renderFilteredPeople);
            });
            var exp = document.getElementById("an-people-export");
            if (exp) exp.addEventListener("click", function () {
                var filtered = _getFilteredPeople();
                var h = ["#", "ФИО", "ИИН", "Возраст", "Пол", "Национальность", "Образование", "Род занятий", "Адрес", "Статья", "ЕРДР", "Судимость"];
                var r = filtered.map(function (p, i) {
                    return [i + 1,
                        [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" "),
                        p.iin || "", p.age || "", p.gender || "", p.nationality || "",
                        p.education || "", p.occupation || "",
                        [p.addrCity, p.addrStreet, p.addrHouse].filter(Boolean).join(", "),
                        p.article || "", p.erdr || "", p.conviction || ""];
                });
                _exportXlsx(h, r, "People_filtered_" + new Date().toISOString().slice(0, 10) + ".xlsx");
            });
        }
        _renderFilteredPeople();
    }

    function _getFilteredPeople() {
        var people = (typeof crimePeople !== "undefined") ? crimePeople : [];
        if (!people.length) return [];
        var qEl = document.getElementById("an-people-search");
        var ageEl = document.getElementById("an-people-age-filter");
        var gEl = document.getElementById("an-people-gender-filter");
        var eEl = document.getElementById("an-people-edu-filter");
        var oEl = document.getElementById("an-people-occ-filter");
        var q = qEl ? (qEl.value || "").trim().toLowerCase() : "";
        var age = ageEl ? ageEl.value : "";
        var gender = gEl ? gEl.value : "";
        var edu = eEl ? eEl.value : "";
        var occ = oEl ? oEl.value : "";

        return people.filter(function (p) {
            if (q) {
                var fio = [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ").toLowerCase();
                if (fio.indexOf(q) === -1 && (!p.iin || p.iin.indexOf(q) === -1)) return false;
            }
            if (age) {
                var a = p.age || 0;
                if (age === "minor" && a >= 18) return false;
                if (age === "18-25" && (a < 18 || a > 25)) return false;
                if (age === "26-35" && (a < 26 || a > 35)) return false;
                if (age === "36-45" && (a < 36 || a > 45)) return false;
                if (age === "46-55" && (a < 46 || a > 55)) return false;
                if (age === "56+" && a < 56) return false;
            }
            if (gender && p.gender !== gender) return false;
            if (edu && p.education !== edu) return false;
            if (occ && p.occupation !== occ) return false;
            return true;
        });
    }

    function _renderFilteredPeople() {
        var list = _getFilteredPeople();
        document.getElementById("an-people-count-val").textContent = list.length;
        var container = document.getElementById("an-people-list");
        if (list.length === 0) {
            container.innerHTML = '<div class="an-empty">По заданным фильтрам ничего не найдено</div>';
            return;
        }
        container.innerHTML = list.slice(0, 200).map(function (p) {
            var fio = [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ") || "—";
            var isMinor = p.age && p.age < 18;
            var meta = [];
            if (p.age) meta.push('<span><strong>' + p.age + '</strong> лет</span>');
            if (p.gender) meta.push('<span>' + p.gender + '</span>');
            if (p.article) meta.push('<span>📋 ' + p.article + '</span>');
            if (p.occupation) meta.push('<span>💼 ' + p.occupation + '</span>');
            return '<div class="an-people-card' + (isMinor ? ' minor' : '') + '" data-erdr="' + (p.erdr || "") + '">' +
                '<div class="an-people-card-fio">' + fio + '</div>' +
                '<div class="an-people-card-meta">' + meta.join("") + '</div>' +
                '</div>';
        }).join("") + (list.length > 200 ? '<div class="an-empty">Показаны первые 200. Уточните поиск.</div>' : "");

        container.querySelectorAll(".an-people-card").forEach(function (card) {
            card.addEventListener("click", function () {
                var erdr = this.getAttribute("data-erdr");
                var p = crimePeople.find(function (x) { return x.erdr === erdr; });
                if (p) _showPeopleResults([p]);
            });
        });
    }

    function _showPeopleResults(people) {
        var h = '<div class="minors-portrait-overlay" id="minors-portrait-overlay">' +
            '<div class="minors-portrait-modal">' +
            '<div class="minors-portrait-header">' +
            '<h2>Лица (' + people.length + (people.length >= 50 ? '+' : '') + ')</h2>' +
            '<button class="minors-portrait-close" id="minors-portrait-close">&times;</button>' +
            '</div><div class="minors-portrait-list">';
        people.forEach(function (p, i) {
            var fio = [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ");
            var crime = crimeIncidents.find(function (c) { return c.erdr === p.erdr; });
            h += '<div class="minor-card"><div class="minor-card-num">' + (i + 1) + '</div><div class="minor-card-body">';
            if (fio) h += '<div style="font-weight:700;margin-bottom:4px;">' + fio + '</div>';
            h += '<div class="cp-grid">';
            if (p.age) h += '<div class="minor-row"><strong>Возраст:</strong> ' + p.age + '</div>';
            if (p.gender) h += '<div class="minor-row"><strong>Пол:</strong> ' + p.gender + '</div>';
            if (p.nationality) h += '<div class="minor-row"><strong>Национальность:</strong> ' + p.nationality + '</div>';
            if (p.education) h += '<div class="minor-row"><strong>Образование:</strong> ' + p.education + '</div>';
            if (p.occupation) h += '<div class="minor-row"><strong>Род занятий:</strong> ' + p.occupation + '</div>';
            if (p.conviction) h += '<div class="minor-row"><strong>Судимость:</strong> ' + p.conviction + '</div>';
            h += '</div>';
            if (crime || p.article) {
                h += '<div class="minor-crime">';
                h += '<div class="minor-row"><strong>Статья:</strong> ' + (p.article || (crime && crime.article) || "") + '</div>';
                h += '<div class="minor-row"><strong>ЕРДР:</strong> ' + (p.erdr || "") + '</div>';
                h += '</div>';
            }
            h += '</div></div>';
        });
        h += '</div></div></div>';
        var old = document.getElementById("minors-portrait-overlay");
        if (old) old.remove();
        document.body.insertAdjacentHTML("beforeend", h);
        document.getElementById("minors-portrait-close").addEventListener("click", function () {
            document.getElementById("minors-portrait-overlay").remove();
        });
        document.getElementById("minors-portrait-overlay").addEventListener("click", function (e) {
            if (e.target === this) this.remove();
        });
    }

    function renderOverviewStats(a, filtered) {
        var el = document.getElementById("an-overview-stats");
        if (!el) return;
        var organs = {};
        filtered.forEach(function (c) { if (c.organ) organs[c.organ] = true; });

        el.innerHTML =
            _statCard(a.total, "Всего") +
            _statCard(a.publicCount, "Общ. места") +
            _statCard(a.withCoords, "С координатами") +
            _statCard(a.byArticle.length, "Статей") +
            _statCard(Object.keys(organs).length, "Органов") +
            _statCard(a.problemZones.length, "Зон");
    }

    function renderPeopleStats(pa) {
        var el = document.getElementById("an-people-stats");
        if (!el) return;
        el.innerHTML =
            _statCard(pa.total, "Всего лиц") +
            '<div class="an-stat-card an-stat-clickable" id="an-minors-card"><div class="an-stat-val">' + pa.minors + '</div><div class="an-stat-lbl">Несовершеннолетних ▸</div></div>' +
            _statCard(pa.byNationality.length, "Национальностей") +
            _statCard(pa.byEducation.length, "Уровней образ.") +
            _statCard(pa.byOccupation.length, "Родов занятий");

        var minorsCard = document.getElementById("an-minors-card");
        if (minorsCard && pa.minors > 0) {
            minorsCard.addEventListener("click", function () {
                showMinorsPortrait();
            });
        }
    }

    function showMinorsPortrait() {
        var minors = (typeof crimePeople !== "undefined" ? crimePeople : []).filter(function (p) {
            return p.age !== null && p.age < 18;
        });
        if (minors.length === 0) { alert("Несовершеннолетних не найдено"); return; }
        var html = '<div class="minors-portrait-overlay" id="minors-portrait-overlay">' +
            '<div class="minors-portrait-modal">' +
            '<div class="minors-portrait-header">' +
            '<h2>Портрет несовершеннолетних (' + minors.length + ')</h2>' +
            '<button class="minors-portrait-close" id="minors-portrait-close">&times;</button>' +
            '</div>' +
            '<div class="minors-portrait-list">';
        minors.forEach(function (p, i) {
            var crime = crimeIncidents.find(function (c) { return c.erdr === p.erdr; });
            var fio = [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ");
            html += '<div class="minor-card">';
            html += '<div class="minor-card-num">' + (i + 1) + '</div>';
            html += '<div class="minor-card-body">';
            if (fio) html += '<div class="minor-row" style="font-size:14px;font-weight:700;color:#e74c3c;margin-bottom:6px;">' + fio + '</div>';
            html += '<div class="cp-grid">';
            html += '<div class="minor-row"><strong>Возраст:</strong> ' + (p.age || "—") + '</div>';
            html += '<div class="minor-row"><strong>Пол:</strong> ' + (p.gender || "—") + '</div>';
            if (p.birthDate) html += '<div class="minor-row"><strong>Дата рождения:</strong> ' + formatDateOnly(p.birthDate) + '</div>';
            html += '<div class="minor-row"><strong>Национальность:</strong> ' + (p.nationality || "—") + '</div>';
            html += '<div class="minor-row"><strong>Гражданство:</strong> ' + (p.citizenship || "—") + '</div>';
            html += '<div class="minor-row"><strong>Образование:</strong> ' + (p.education || "—") + '</div>';
            html += '<div class="minor-row"><strong>Род занятий:</strong> ' + (p.occupation || "—") + '</div>';
            html += '<div class="minor-row"><strong>Место работы/учёбы:</strong> ' + (p.workplace || "—") + '</div>';
            html += '<div class="minor-row"><strong>Сем. положение:</strong> ' + (p.maritalStatus || "—") + '</div>';
            var birthPlace = [p.birthCity, p.birthDistrict, p.birthOblast].filter(Boolean).join(", ");
            if (birthPlace) html += '<div class="minor-row"><strong>Место рождения:</strong> ' + birthPlace + '</div>';
            var addr = [p.addrCity, p.addrStreet, p.addrHouse].filter(Boolean).join(", ");
            if (addr) html += '<div class="minor-row"><strong>Адрес:</strong> ' + addr + '</div>';
            if (p.intoxication) html += '<div class="minor-row"><strong>В состоянии:</strong> ' + p.intoxication + '</div>';
            if (p.previousCrime) html += '<div class="minor-row"><strong>Ранее совершивший:</strong> ' + p.previousCrime + '</div>';
            if (p.conviction) html += '<div class="minor-row"><strong>Судимость:</strong> ' + p.conviction + '</div>';
            if (p.registeredAccount) html += '<div class="minor-row"><strong>На учёте:</strong> ' + p.registeredAccount + '</div>';
            if (p.additionalInfo) html += '<div class="minor-row"><strong>Доп. сведения:</strong> ' + p.additionalInfo + '</div>';
            if (p.decision) html += '<div class="minor-row"><strong>Решение:</strong> ' + p.decision + '</div>';
            html += '</div>';
            if (crime || p.article) {
                html += '<div class="minor-crime">';
                html += '<div class="minor-row"><strong>Статья:</strong> ' + (p.article || (crime && crime.article) || "—") + '</div>';
                if (p.crimeDescription) html += '<div class="minor-row"><strong>Описание:</strong> ' + p.crimeDescription + '</div>';
                html += '<div class="minor-row"><strong>Дата совершения:</strong> ' + formatDateOnly(p.crimeDate) + ' ' + formatTimeOnly(p.crimeTime) + '</div>';
                if (crime) html += '<div class="minor-row"><strong>Адрес:</strong> ' + (crime.street || "") + ' ' + (crime.place || "") + '</div>';
                html += '<div class="minor-row"><strong>ЕРДР:</strong> ' + (p.erdr || "—") + '</div>';
                html += '</div>';
            }
            html += '</div></div>';
        });
        html += '</div></div></div>';
        document.body.insertAdjacentHTML("beforeend", html);
        document.getElementById("minors-portrait-close").addEventListener("click", function () {
            var ov = document.getElementById("minors-portrait-overlay");
            if (ov) ov.remove();
        });
        document.getElementById("minors-portrait-overlay").addEventListener("click", function (e) {
            if (e.target === this) this.remove();
        });
    }

    function _statCard(val, label) {
        return '<div class="an-stat-card"><div class="an-stat-val">' + val + '</div><div class="an-stat-lbl">' + label + '</div></div>';
    }

    function _renderBars(items, color) {
        if (items.length === 0) return "";
        var max = items[0].count || 1;
        return items.map(function (item) {
            var pct = Math.max(1, Math.round(item.count / max * 100));
            return '<div class="an-bar-row">' +
                '<div class="an-bar-top">' +
                    '<span class="an-bar-label">' + item.label + '</span>' +
                    '<span class="an-bar-value">' + item.count + '</span>' +
                '</div>' +
                '<div class="an-bar-track"><div class="an-bar-fill ' + color + '" style="width:' + pct + '%"></div></div>' +
                '</div>';
        }).join("");
    }

    function renderBarChart(containerId, items, color) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!items || items.length === 0) { el.innerHTML = '<div class="an-empty">Нет данных</div>'; return; }
        el.innerHTML = _renderAnalyticsTable(items);
    }

    function _renderAnalyticsTable(items) {
        var total = items.reduce(function (s, it) { return s + (it.count || 0); }, 0);
        var max = items[0].count || 1;
        var html = '<table class="an-table"><thead><tr>' +
            '<th class="an-th-num">#</th>' +
            '<th>Категория</th>' +
            '<th class="an-th-count">Кол-во</th>' +
            '<th class="an-th-share">Доля</th>' +
            '<th class="an-th-bar">Распределение</th>' +
            '</tr></thead><tbody>';
        items.forEach(function (it, i) {
            var pct = Math.round((it.count || 0) / max * 100);
            var sharePct = total > 0 ? Math.round((it.count || 0) / total * 100) : 0;
            html += '<tr>' +
                '<td class="an-th-num">' + (i + 1) + '</td>' +
                '<td>' + (it.label || "") + '</td>' +
                '<td class="an-th-count"><strong>' + it.count + '</strong></td>' +
                '<td class="an-th-share">' + sharePct + '%</td>' +
                '<td class="an-th-bar"><div class="an-mini-bar"><div class="an-mini-bar-fill" style="width:' + pct + '%;"></div></div></td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderExpandableChart(containerId, allItems, initialCount, color) {
        var el = document.getElementById(containerId);
        if (!el || allItems.length === 0) { if (el) el.innerHTML = ""; return; }

        var showAll = allItems.length > initialCount;
        var visibleItems = showAll ? allItems.slice(0, initialCount) : allItems;

        el.innerHTML = _renderBars(visibleItems, color);

        if (showAll) {
            var toggleBtn = document.createElement("button");
            toggleBtn.className = "an-expand-btn";
            toggleBtn.textContent = "Показать все (" + allItems.length + ")";
            var expanded = false;
            toggleBtn.addEventListener("click", function () {
                expanded = !expanded;
                var barsHtml = _renderBars(expanded ? allItems : allItems.slice(0, initialCount), color);
                // Replace bars but keep button
                var barsContainer = el.querySelector(".an-expand-bars");
                if (barsContainer) barsContainer.innerHTML = barsHtml;
                toggleBtn.textContent = expanded ? "Свернуть" : "Показать все (" + allItems.length + ")";
            });
            // Wrap bars in a container for easy replacement
            var wrapper = document.createElement("div");
            wrapper.className = "an-expand-bars";
            wrapper.innerHTML = el.innerHTML;
            el.innerHTML = "";
            el.appendChild(wrapper);
            el.appendChild(toggleBtn);
        }
    }

    function renderGroupedAuthorsChart(containerId, groups) {
        var el = document.getElementById(containerId);
        if (!el || groups.length === 0) { if (el) el.innerHTML = ""; return; }

        var globalMax = 1;
        groups.forEach(function (g) {
            g.authors.forEach(function (a) { if (a.count > globalMax) globalMax = a.count; });
        });

        el.innerHTML = "";
        groups.forEach(function (g) {
            var group = document.createElement("div");
            group.className = "av-author-group";

            var header = document.createElement("div");
            header.className = "av-author-group-header";
            header.innerHTML =
                '<span class="av-author-group-name">' +
                    '<svg class="av-group-arrow" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                    g.label +
                '</span>' +
                '<span class="av-author-group-total">' + g.total + '</span>';

            var body = document.createElement("div");
            body.className = "av-author-group-body";
            body.style.display = "none";
            g.authors.forEach(function (a) {
                var pct = Math.max(1, Math.round(a.count / globalMax * 100));
                body.innerHTML += '<div class="an-bar-row">' +
                    '<div class="an-bar-top">' +
                        '<span class="an-bar-label">' + a.label + '</span>' +
                        '<span class="an-bar-value">' + a.count + '</span>' +
                    '</div>' +
                    '<div class="an-bar-track"><div class="an-bar-fill blue" style="width:' + pct + '%"></div></div>' +
                    '</div>';
            });

            header.addEventListener("click", function () {
                var open = body.style.display !== "none";
                body.style.display = open ? "none" : "";
                group.classList.toggle("open", !open);
            });

            group.appendChild(header);
            group.appendChild(body);
            el.appendChild(group);
        });
    }

    function renderMonthsChart(byMonth) {
        var items = byMonth.labels.map(function (l, i) {
            return { label: l, count: byMonth.counts[i] };
        });
        renderBarChart("an-months-chart", items, "green");
    }

    function renderOrgansChart(filtered) {
        var organMap = {};
        filtered.forEach(function (c) {
            var key = c.organ || "Не указан";
            if (!organMap[key]) organMap[key] = 0;
            organMap[key]++;
        });
        var items = Object.keys(organMap).map(function (k) { return { label: k, count: organMap[k] }; })
            .sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
        renderBarChart("an-organs-chart", items, "teal");
    }

    function renderHoursChart(hours) {
        var items = hours.map(function (count, h) {
            return { label: ("0" + h).slice(-2) + ":00", count: count };
        });
        var el = document.getElementById("an-hours-chart");
        if (!el) return;
        var max = Math.max.apply(null, hours) || 1;
        el.innerHTML = items.map(function (item) {
            var pct = Math.max(1, Math.round(item.count / max * 100));
            var color = item.count > max * 0.7 ? "red" : item.count > max * 0.4 ? "orange" : "blue";
            return '<div class="an-bar-row">' +
                '<div class="an-bar-top">' +
                    '<span class="an-bar-label">' + item.label + '</span>' +
                    '<span class="an-bar-value">' + item.count + '</span>' +
                '</div>' +
                '<div class="an-bar-track"><div class="an-bar-fill ' + color + '" style="width:' + pct + '%"></div></div>' +
                '</div>';
        }).join("");
    }

    function renderDaysChart(data) {
        var items = data.labels.map(function (l, i) {
            return { label: l, count: data.counts[i] };
        });
        renderBarChart("an-days-chart", items, "blue");
    }

    function renderDangerTimes(analysis) {
        var el = document.getElementById("an-danger-times");
        if (!el) return;

        // Find peak hours
        var hours = analysis.byHour;
        var maxH = Math.max.apply(null, hours);
        var peakHours = [];
        hours.forEach(function (c, h) { if (c >= maxH * 0.7) peakHours.push(h); });

        // Find peak day
        var days = analysis.byDayOfWeek;
        var maxD = Math.max.apply(null, days.counts);
        var peakDay = days.labels[days.counts.indexOf(maxD)];

        // Public percent
        var pubPct = analysis.total > 0 ? Math.round(analysis.publicCount / analysis.total * 100) : 0;

        el.innerHTML =
            '<div class="an-insight-card">' +
                '<span class="an-danger-badge an-danger-high">Пиковые часы</span>' +
                '<h4>' + peakHours.map(function (h) { return ("0" + h).slice(-2) + ":00"; }).join(", ") + '</h4>' +
                '<p>В это время совершается больше всего правонарушений.</p>' +
            '</div>' +
            '<div class="an-insight-card">' +
                '<span class="an-danger-badge an-danger-med">Опасный день</span>' +
                '<h4>' + peakDay + ' (' + maxD + ' случаев)</h4>' +
                '<p>Самый криминогенный день недели.</p>' +
            '</div>' +
            '<div class="an-insight-card">' +
                '<span class="an-danger-badge ' + (pubPct > 50 ? "an-danger-high" : "an-danger-med") + '">Общ. места</span>' +
                '<h4>' + pubPct + '% преступлений</h4>' +
                '<p>Доля правонарушений в общественных местах. ' +
                    '' +
                '</p>' +
            '</div>';
    }

    function renderZonesList(zones) {
        var el = document.getElementById("an-zones-list");
        if (!el) return;
        if (zones.length === 0) { el.innerHTML = '<p class="an-hint">Нет данных с координатами</p>'; return; }

        el.innerHTML = zones.slice(0, 10).map(function (z, i) {
            var tags = Object.keys(z.articles).sort(function (a, b) { return z.articles[b] - z.articles[a]; }).slice(0, 3)
                .map(function (a) { return '<span class="an-zone-tag">' + a + ' (' + z.articles[a] + ')</span>'; }).join("");
            var peakTime = z.peakHour !== undefined ? ("0" + z.peakHour).slice(-2) + ":00" : "—";

            return '<div class="an-zone-card">' +
                '<div class="an-zone-rank d' + z.dangerLevel + '">' + (i + 1) + '</div>' +
                '<div class="an-zone-info">' +
                    '<h4>' + z.count + ' правонарушений</h4>' +
                    '<p>Координаты: ' + z.lat.toFixed(4) + ', ' + z.lng.toFixed(4) + '</p>' +
                    '<p>Пиковое время: ' + peakTime + ' | В общ. местах: ' + z.publicCount + '</p>' +
                    '<div class="an-zone-tags">' + tags + '</div>' +
                '</div>' +
            '</div>';
        }).join("");
    }

    // Show zones on map
    var showZonesBtn = document.getElementById("an-show-zones-on-map");
    if (showZonesBtn) {
        showZonesBtn.addEventListener("click", function () {
            hideAnalyticsPanel();
            showZonesOnMap();
        });
    }

    var zonesActive = false;

    function _zoneColorByCount(count, maxCount) {
        var ratio = count / maxCount;
        if (ratio >= 0.8) return "#8e0000";   // очень высокая
        if (ratio >= 0.6) return "#e74c3c";   // критическая
        if (ratio >= 0.4) return "#e67e22";   // высокая
        if (ratio >= 0.2) return "#f39c12";   // средняя
        return "#27ae60";                       // низкая
    }

    function _zoneLabelText(count, maxCount) {
        var ratio = count / maxCount;
        if (ratio >= 0.8) return "очень высокая";
        if (ratio >= 0.6) return "критическая";
        if (ratio >= 0.4) return "высокая";
        if (ratio >= 0.2) return "средняя";
        return "низкая";
    }

    function showZonesOnMap() {
        clearZonesFromMap();
        if (crimeIncidents.length === 0) return;

        // Фильтруем преступления: только с координатами и не скрытые статьи
        var validCrimes = crimeIncidents.filter(function (c) {
            if (typeof c.lat !== "number" || typeof c.lng !== "number") return false;
            if (isNaN(c.lat) || isNaN(c.lng)) return false;
            if (_isHiddenArticle(c.article)) return false;
            return true;
        });
        if (validCrimes.length === 0) return;

        // Кластеризация: крупная сетка для более крупных "очагов"
        var zones = findProblemZones(validCrimes, 0.008).filter(function (z) { return z.count >= 2; });
        if (zones.length === 0) return;

        var maxCount = zones[0].count || 1;

        zones.slice(0, 25).forEach(function (z) {
            // Радиус пропорционален количеству (250м-900м)
            var radius = Math.max(250, Math.min(900, 250 + (z.count / maxCount) * 650));
            var color = _zoneColorByCount(z.count, maxCount);
            var levelText = _zoneLabelText(z.count, maxCount);

            var circle = L.circle([z.lat, z.lng], {
                radius: radius,
                color: color,
                weight: 2.5,
                fillColor: color,
                fillOpacity: 0.22,
                className: "zone-problem-circle"
            }).addTo(map);

            // Центральный маркер с числом и уровнем
            var label = L.marker([z.lat, z.lng], {
                icon: L.divIcon({
                    className: "zone-circle-label",
                    html: '<div class="zone-label-inner" style="border-color:' + color + ';color:' + color + '">' +
                          '<div class="zone-label-count">' + z.count + '</div>' +
                          '<div class="zone-label-unit">случаев</div>' +
                          '</div>',
                    iconSize: [64, 64],
                    iconAnchor: [32, 32]
                }),
                interactive: false
            }).addTo(map);

            // Топ статьи
            var sortedArts = Object.keys(z.articles).sort(function (a, b) {
                return z.articles[b] - z.articles[a];
            }).slice(0, 3);
            var topArtsHtml = sortedArts.map(function (a) {
                return '<li><b>' + a + '</b> — ' + z.articles[a] + '</li>';
            }).join("");

            // Топ улицы
            var streetMap = {};
            z.crimes.forEach(function (c) {
                if (c.street) streetMap[c.street] = (streetMap[c.street] || 0) + 1;
            });
            var topStreets = Object.keys(streetMap).sort(function (a, b) {
                return streetMap[b] - streetMap[a];
            }).slice(0, 3);
            var topStreetsHtml = topStreets.length
                ? topStreets.map(function (s) { return '<li>ул. ' + s + ' (' + streetMap[s] + ')</li>'; }).join("")
                : '<li style="color:#8899b0">нет данных</li>';

            var peakTime = z.peakHour !== undefined ? ("0" + z.peakHour).slice(-2) + ":00" : "—";
            var publicPct = Math.round((z.publicCount / z.count) * 100);

            var popupHtml =
                '<div class="zone-popup">' +
                    '<div class="zone-popup-header" style="background:' + color + '">' +
                        '<div class="zone-popup-count">' + z.count + '</div>' +
                        '<div class="zone-popup-level">уровень: ' + levelText + '</div>' +
                    '</div>' +
                    '<div class="zone-popup-body">' +
                        '<div class="zone-popup-section">' +
                            '<div class="zone-popup-title">Основные статьи</div>' +
                            '<ul class="zone-popup-list">' + topArtsHtml + '</ul>' +
                        '</div>' +
                        '<div class="zone-popup-section">' +
                            '<div class="zone-popup-title">Топ улиц</div>' +
                            '<ul class="zone-popup-list">' + topStreetsHtml + '</ul>' +
                        '</div>' +
                        '<div class="zone-popup-stats">' +
                            '<div class="zone-popup-stat"><span>⏰</span> Пик: <b>' + peakTime + '</b></div>' +
                            '<div class="zone-popup-stat"><span>🏛️</span> В общ. местах: <b>' + publicPct + '%</b> (' + z.publicCount + ')</div>' +
                            '<div class="zone-popup-stat"><span>📍</span> Радиус: <b>~' + Math.round(radius) + 'м</b></div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            circle.bindPopup(popupHtml, { maxWidth: 300, className: "zone-popup-wrapper" });

            zoneCircles.push(circle);
            zoneCircles.push(label);
        });

        // Показать легенду
        document.getElementById("zones-legend").classList.remove("hidden");
        document.getElementById("zones-toggle").classList.add("active");
        zonesActive = true;
    }

    function clearZonesFromMap() {
        zoneCircles.forEach(function (c) { map.removeLayer(c); });
        zoneCircles = [];
        document.getElementById("zones-legend").classList.add("hidden");
        var btn = document.getElementById("zones-toggle");
        if (btn) btn.classList.remove("active");
        zonesActive = false;
    }

    function toggleZonesOnMap() {
        if (zonesActive) clearZonesFromMap();
        else showZonesOnMap();
    }

    // Кнопка на панели карты
    var zonesToggleBtn = document.getElementById("zones-toggle");
    if (zonesToggleBtn) {
        zonesToggleBtn.addEventListener("click", toggleZonesOnMap);
    }
    var zonesLegendClose = document.getElementById("zones-legend-close");
    if (zonesLegendClose) {
        zonesLegendClose.addEventListener("click", clearZonesFromMap);
    }

    // AI Analysis
    var aiRunBtn = document.getElementById("an-ai-run");
    if (aiRunBtn) {
        aiRunBtn.addEventListener("click", function () {
            var keyInput = document.getElementById("an-ai-key");
            var apiKey = keyInput ? keyInput.value.trim().replace(/[^\x20-\x7E]/g, "") : "";
            if (!apiKey) { alert("Введите API ключ OpenAI (sk-...)"); return; }

            var statusEl = document.getElementById("an-ai-status");
            var resultEl = document.getElementById("an-ai-result");
            statusEl.classList.remove("hidden");
            statusEl.textContent = "AI анализирует данные...";
            resultEl.textContent = "";
            aiRunBtn.disabled = true;

            var analysis = window._lastAnalysis || runFullAnalysis(crimeIncidents);
            var summary = buildAnalysisSummaryForAI(analysis);

            requestAIAnalysis(summary, apiKey, function (err, text) {
                statusEl.classList.add("hidden");
                aiRunBtn.disabled = false;
                if (err) {
                    resultEl.textContent = "Ошибка: " + err.message;
                } else {
                    resultEl.innerHTML = markdownToHtml(text);
                }
            });
        });
    }

    // Crime modal
    function openCrimeModal(crime) {
        var overlay = document.getElementById("crime-modal-overlay");
        document.getElementById("crime-modal-article").textContent = crime.article + (crime.articlePart ? " " + crime.articlePart : "");
        document.getElementById("crime-modal-date").textContent = formatCrimeDate(crime.regDate);
        document.getElementById("crime-modal-erdr").textContent = "ЕРДР: " + crime.erdr;
        document.getElementById("crime-modal-organ").innerHTML =
            '<strong>' + t("crime_organ") + ':</strong> ' + crime.organ;
        document.getElementById("crime-modal-place").innerHTML =
            '<strong>' + t("crime_place_type") + ':</strong> ' + crime.placeType +
            (crime.isPublic ? ' <span class="crime-public-badge">' + t("crime_public_place") + '</span>' : '');
        document.getElementById("crime-modal-address").innerHTML =
            '<strong>' + t("crime_address") + ':</strong> ' + buildCrimeAddress(crime);
        document.getElementById("crime-modal-crime-date").innerHTML =
            '<strong>' + t("crime_date_committed") + ':</strong> ' + formatDateOnly(crime.crimeDate) + ' ' + formatTimeOnly(crime.crimeTime);
        document.getElementById("crime-modal-description").textContent = crime.description;

        // Показать связанных лиц
        var peopleEl = document.getElementById("crime-modal-people");
        if (peopleEl) {
            var people = getPeopleForCrime(crime);
            if (people.length > 0) {
                peopleEl.innerHTML = '<h3 style="margin:12px 0 8px;color:#5dade2;">Лица (' + people.length + ')</h3>' +
                    people.map(function (p, i) {
                        var fio = [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ");
                        var isMin = p.isMinor && p.isMinor.toLowerCase().indexOf("да") !== -1;
                        var h = '<div class="crime-person-card' + (isMin ? ' is-minor' : '') + '">';
                        h += '<div class="cp-header"><strong>Лицо ' + (i + 1) + (fio ? ': ' + fio : '') + '</strong>';
                        if (isMin) h += ' <span class="cp-minor-badge">несовершеннолетний</span>';
                        h += '</div>';
                        h += '<div class="cp-grid">';
                        if (p.age) h += '<div class="cp-row"><span class="cp-label">Возраст:</span> ' + p.age + '</div>';
                        if (p.gender) h += '<div class="cp-row"><span class="cp-label">Пол:</span> ' + p.gender + '</div>';
                        if (p.birthDate) h += '<div class="cp-row"><span class="cp-label">Дата рождения:</span> ' + formatDateOnly(p.birthDate) + '</div>';
                        if (p.nationality) h += '<div class="cp-row"><span class="cp-label">Национальность:</span> ' + p.nationality + '</div>';
                        if (p.citizenship) h += '<div class="cp-row"><span class="cp-label">Гражданство:</span> ' + p.citizenship + '</div>';
                        if (p.education) h += '<div class="cp-row"><span class="cp-label">Образование:</span> ' + p.education + '</div>';
                        if (p.maritalStatus) h += '<div class="cp-row"><span class="cp-label">Сем. положение:</span> ' + p.maritalStatus + '</div>';
                        if (p.occupation) h += '<div class="cp-row"><span class="cp-label">Род занятий:</span> ' + p.occupation + '</div>';
                        if (p.workplace) h += '<div class="cp-row"><span class="cp-label">Место работы/учёбы:</span> ' + p.workplace + '</div>';
                        if (p.position) h += '<div class="cp-row"><span class="cp-label">Должность:</span> ' + p.position + '</div>';
                        var birthPlace = [p.birthCity, p.birthDistrict, p.birthOblast].filter(Boolean).join(", ");
                        if (birthPlace) h += '<div class="cp-row"><span class="cp-label">Место рождения:</span> ' + birthPlace + '</div>';
                        var addr = [p.addrCity, p.addrStreet, p.addrHouse].filter(Boolean).join(", ");
                        if (addr) h += '<div class="cp-row"><span class="cp-label">Адрес:</span> ' + addr + '</div>';
                        if (p.residencePlace) h += '<div class="cp-row"><span class="cp-label">По месту проживания:</span> ' + p.residencePlace + '</div>';
                        if (p.intoxication) h += '<div class="cp-row"><span class="cp-label">В состоянии:</span> ' + p.intoxication + '</div>';
                        if (p.inGroup) h += '<div class="cp-row"><span class="cp-label">В группе:</span> ' + p.inGroup + '</div>';
                        if (p.participationType) h += '<div class="cp-row"><span class="cp-label">Вид соучастия:</span> ' + p.participationType + '</div>';
                        if (p.previousCrime) h += '<div class="cp-row"><span class="cp-label">Ранее совершивший:</span> ' + p.previousCrime + '</div>';
                        if (p.conviction) h += '<div class="cp-row"><span class="cp-label">Судимость:</span> ' + p.conviction + '</div>';
                        if (p.registeredAccount) h += '<div class="cp-row"><span class="cp-label">Состоял на учёте:</span> ' + p.registeredAccount + '</div>';
                        if (p.additionalInfo) h += '<div class="cp-row"><span class="cp-label">Доп. сведения:</span> ' + p.additionalInfo + '</div>';
                        if (p.decision) h += '<div class="cp-row"><span class="cp-label">Решение:</span> ' + p.decision + '</div>';
                        h += '</div></div>';
                        return h;
                    }).join("");
            } else {
                peopleEl.innerHTML = "";
            }
        }

        // Кнопка панорамы (если есть координаты)
        var panoramaBtnEl = document.getElementById("crime-modal-panorama");
        if (panoramaBtnEl) {
            if (typeof crime.lat === "number" && typeof crime.lng === "number") {
                panoramaBtnEl.classList.remove("hidden");
                panoramaBtnEl.onclick = function () {
                    overlay.classList.add("hidden");
                    openPanorama(crime.lat.toFixed(6), crime.lng.toFixed(6));
                };
            } else {
                panoramaBtnEl.classList.add("hidden");
            }
        }

        overlay.classList.remove("hidden");
    }

    document.getElementById("crime-modal-close").addEventListener("click", function () {
        document.getElementById("crime-modal-overlay").classList.add("hidden");
    });
    document.getElementById("crime-modal-overlay").addEventListener("click", function (e) {
        if (e.target === this) this.classList.add("hidden");
    });

    // ── ЕРДР маркеры на карте (из координат X/Y, без ст. 190) ──
    var crimeErdrLayer = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: function (cluster) {
            var count = cluster.getChildCount();
            var size = count < 10 ? 20 : count < 50 ? 26 : 32;
            return L.divIcon({
                html: '<div style="background:rgba(231,76,60,0.85);width:' + size + 'px;height:' + size + 'px;' +
                    'border-radius:50%;display:flex;align-items:center;justify-content:center;' +
                    'color:#fff;font-weight:700;font-size:10px;border:2px solid rgba(255,255,255,0.6);">' + count + '</div>',
                className: 'erdr-cluster',
                iconSize: L.point(size, size)
            });
        }
    });
    map.addLayer(crimeErdrLayer);

    function _crimeGuestPopup(c) {
        return '<div style="padding:8px 4px;font-size:13px;min-width:140px;text-align:center;">' +
               '<div style="font-size:11px;color:#888;margin-bottom:4px;">Статья</div>' +
               '<div style="font-size:16px;font-weight:700;color:#e74c3c;">' + (c.article || "—") + '</div>' +
               '</div>';
    }

    function _attachCrimeHandler(marker, c) {
        marker.on("click", function () {
            marker.unbindPopup();
            if (isStaff) {
                openCrimeModal(c);
            } else {
                marker.bindPopup(_crimeGuestPopup(c), { closeButton: true }).openPopup();
            }
        });
    }

    function buildCrimeMarkers() {
        crimeErdrLayer.clearLayers();
        var added = 0;
        crimeIncidents.forEach(function (c) {
            if (typeof c.lat !== "number" || typeof c.lng !== "number") return;
            if (isNaN(c.lat) || isNaN(c.lng)) return;
            if (_isHiddenArticle(c.article)) return;
            if (sidebarCrimeArticle && _extractNum(c.article) !== sidebarCrimeArticle) return;

            var marker = L.circleMarker([c.lat, c.lng], {
                radius: 3.5,
                color: "rgba(255,255,255,0.8)",
                weight: 1,
                fillColor: "#e74c3c",
                fillOpacity: 0.9
            });

            if (isStaff) {
                var tooltipText = (c.article || "—") + " | " + (c.street ? "ул. " + c.street : "");
                marker.bindTooltip(tooltipText, {
                    direction: "top", offset: [0, -8], className: "marker-tooltip"
                });
            } else {
                marker.bindTooltip("Ст. " + (c.article || "—"), {
                    direction: "top", offset: [0, -8], className: "marker-tooltip"
                });
            }

            _attachCrimeHandler(marker, c);
            crimeErdrLayer.addLayer(marker);
            added++;
        });
        console.log("[map] ЕРДР маркеров на карте: " + added);
    }

    // Загрузить данные
    var crimeLoadingEl = document.getElementById("crime-loading-status");

    function _onCrimeDataReady() {
        if (crimeLoadingEl) crimeLoadingEl.classList.add("hidden");
        buildCrimeMarkers();
        updateStats();
    }
    initCrimeData(null, _onCrimeDataReady);

    // Автообновление данных из Google Sheets каждые 5 минут
    setInterval(function () {
        console.log("[auto-refresh] Обновление данных из Google Sheets...");
        initCrimeData(null, function () {
            _onCrimeDataReady();
            // Если открыта аналитика — перерисовать
            var ap = document.getElementById("analytics-panel");
            if (ap && !ap.classList.contains("hidden") && typeof renderAnalytics === "function") {
                renderAnalytics();
            }
        });
    }, 5 * 60 * 1000);

    // ═══════════════════════════════════════════════════════
    //  ADMIN VIOLATIONS PANEL
    // ═══════════════════════════════════════════════════════
    var avPanel = document.getElementById("av-panel");
    var avPeriod = "all";
    var avSearchQuery = "";
    var avFilterArticle = "";
    var avFilterUnit = "";
    var avFilterAuthor = "";
    var avSortMode = "date-desc";

    function showAVPanel() {
        mapEl.classList.add("hidden");
        if (searchBar) searchBar.classList.add("hidden");
        if (mapControls) mapControls.classList.add("hidden");
        avPanel.classList.remove("hidden");
        populateAVFilters();
        updateAVStats();
        buildAVList();
    }

    function hideAVPanel() {
        avPanel.classList.add("hidden");
        mapEl.classList.remove("hidden");
        if (searchBar) searchBar.classList.remove("hidden");
        if (mapControls) mapControls.classList.remove("hidden");
        map.invalidateSize();
    }

    document.getElementById("close-av-panel").addEventListener("click", function () {
        hideAVPanel();
        showReportSelector();
    });

    function populateAVFilters() {
        var articles = {}, units = {}, authors = {};
        adminViolations.forEach(function (v) {
            if (v.article) articles[v.article] = true;
            if (v.podrazdelenie) units[v.podrazdelenie] = true;
            if (v.authorFio) authors[v.authorFio] = true;
        });
        _fillSelect("av-filter-article", articles, "Все статьи");
        _fillSelect("av-filter-unit", units, "Все");
        _fillSelect("av-filter-author", authors, "Все");
    }

    function updateAVStats() {
        var all = filterAVByPeriod(avPeriod);
        var articleSet = {};
        var authorSet = {};
        all.forEach(function (v) {
            if (v.article) articleSet[v.article] = true;
            if (v.authorFio) authorSet[v.authorFio] = true;
        });
        _setText("av-total", all.length);
        _setText("av-coords", all.filter(function (v) { return v.lat !== null; }).length);
        _setText("av-articles", Object.keys(articleSet).length);
        _setText("av-authors", Object.keys(authorSet).length);
    }

    function getFilteredAV() {
        var list = filterAVByPeriod(avPeriod);
        if (avFilterArticle) list = list.filter(function (v) { return v.article === avFilterArticle; });
        if (avFilterUnit) list = list.filter(function (v) { return v.podrazdelenie === avFilterUnit; });
        if (avFilterAuthor) list = list.filter(function (v) { return v.authorFio === avFilterAuthor; });
        if (avSearchQuery) {
            var q = avSearchQuery.toLowerCase();
            list = list.filter(function (v) {
                return (v.article || "").toLowerCase().indexOf(q) !== -1 ||
                    (v.lastName || "").toLowerCase().indexOf(q) !== -1 ||
                    (v.firstName || "").toLowerCase().indexOf(q) !== -1 ||
                    (v.place || "").toLowerCase().indexOf(q) !== -1 ||
                    (v.authorFio || "").toLowerCase().indexOf(q) !== -1 ||
                    (v.fabula || "").toLowerCase().indexOf(q) !== -1 ||
                    (v.materialNumber || "").toLowerCase().indexOf(q) !== -1;
            });
        }
        list.sort(function (a, b) {
            switch (avSortMode) {
                case "date-asc": return (a.regDate || "").localeCompare(b.regDate || "");
                case "article": return (a.article || "").localeCompare(b.article || "");
                default: return (b.regDate || "").localeCompare(a.regDate || "");
            }
        });
        return list;
    }

    function buildAVList() {
        var container = document.getElementById("av-list-content");
        var filtered = getFilteredAV();
        container.innerHTML = "";

        filtered.forEach(function (v) {
            var item = document.createElement("div");
            item.className = "crime-list-item";

            var fio = [v.lastName, v.firstName, v.patronymic].filter(Boolean).join(" ") || "—";
            var dateStr = v.regDate ? formatCrimeDate(v.regDate) : "—";

            item.innerHTML =
                '<div class="crime-list-item-header">' +
                    '<span class="crime-list-article">' + (v.article || "—") + '</span>' +
                    '<span class="crime-list-date">' + dateStr + '</span>' +
                '</div>' +
                '<div class="crime-list-erdr">Материал: ' + (v.materialNumber || "—") + '</div>' +
                '<div class="crime-list-address">' + fio + '</div>' +
                '<div class="crime-list-address">' + (v.place || "—") + '</div>' +
                '<div class="crime-list-organ">' + (v.podrazdelenie || "") + '</div>' +
                (v.authorFio ? '<div style="color:#5a6a8a;font-size:11px;margin-top:2px;">Инспектор: ' + v.authorFio + '</div>' : '');

            container.appendChild(item);
        });

        _setText("av-count-value", filtered.length);
    }

    // Period buttons
    document.querySelectorAll(".av-period-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".av-period-btn").forEach(function (b) { b.classList.remove("active"); });
            this.classList.add("active");
            avPeriod = this.getAttribute("data-period");
            updatePeriodHint("av-period-hint", avPeriod);
            updateAVStats();
            buildAVList();
        });
    });

    // Sort
    var avSortEl = document.getElementById("av-sort");
    if (avSortEl) avSortEl.addEventListener("change", function () {
        avSortMode = this.value;
        buildAVList();
    });

    // Filters
    ["av-filter-article", "av-filter-unit", "av-filter-author"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", function () {
            if (id === "av-filter-article") avFilterArticle = this.value;
            else if (id === "av-filter-unit") avFilterUnit = this.value;
            else if (id === "av-filter-author") avFilterAuthor = this.value;
            buildAVList();
        });
    });

    // Search
    var avSearchEl = document.getElementById("av-search-input");
    if (avSearchEl) avSearchEl.addEventListener("input", function () {
        avSearchQuery = this.value.trim();
        buildAVList();
    });

    // Reset
    var avResetBtn = document.getElementById("av-reset-filters");
    if (avResetBtn) avResetBtn.addEventListener("click", function () {
        avSearchQuery = ""; avFilterArticle = ""; avFilterUnit = ""; avFilterAuthor = "";
        avSortMode = "date-desc"; avPeriod = "all";
        if (avSearchEl) avSearchEl.value = "";
        ["av-filter-article", "av-filter-unit", "av-filter-author"].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.value = "";
        });
        if (avSortEl) avSortEl.value = "date-desc";
        document.querySelectorAll(".av-period-btn").forEach(function (b) {
            b.classList.remove("active");
            if (b.getAttribute("data-period") === "all") b.classList.add("active");
        });
        updatePeriodHint("av-period-hint", "all");
        updateAVStats();
        buildAVList();
    });

    // ═══════════════════════════════════════════════════════
    //  AV ANALYTICS PANEL (separate page)
    // ═══════════════════════════════════════════════════════
    var avAnalyticsPanel = document.getElementById("av-analytics-panel");
    var avAnalyticsPeriod = "all";

    function showAVAnalyticsPanel() {
        mapEl.classList.add("hidden");
        if (searchBar) searchBar.classList.add("hidden");
        if (mapControls) mapControls.classList.add("hidden");
        avAnalyticsPanel.classList.remove("hidden");
        renderAVAnalytics();
        var sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("open");
        var ol = document.getElementById("sidebar-overlay");
        if (ol) ol.classList.remove("active");
    }

    function hideAVAnalyticsPanel() {
        avAnalyticsPanel.classList.add("hidden");
        mapEl.classList.remove("hidden");
        if (searchBar) searchBar.classList.remove("hidden");
        if (mapControls) mapControls.classList.remove("hidden");
        map.invalidateSize();
    }

    document.getElementById("close-av-analytics").addEventListener("click", function () {
        hideAVAnalyticsPanel();
        showReportSelector();
    });

    document.getElementById("report-card-av-analytics").addEventListener("click", function () {
        reportSelector.classList.add("hidden");
        showAVAnalyticsPanel();
    });

    document.querySelectorAll(".av-an-period-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".av-an-period-btn").forEach(function (b) { b.classList.remove("active"); });
            this.classList.add("active");
            avAnalyticsPeriod = this.getAttribute("data-period");
            updatePeriodHint("av-analytics-period-hint", avAnalyticsPeriod);
            renderAVAnalytics();
        });
    });

    function renderAVAnalytics() {
        var filtered = filterAVByPeriod(avAnalyticsPeriod);
        if (filtered.length === 0) return;
        var a = analyzeAdminViolations(filtered);

        // Overview stats
        var statsEl = document.getElementById("av-an-overview-stats");
        if (statsEl) {
            statsEl.innerHTML =
                _statCard(a.total, "Всего") +
                _statCard(a.withCoords, "С координатами") +
                _statCard(a.uniqueArticles, "Статей") +
                _statCard(a.uniqueAuthors, "Инспекторов");
        }

        renderGroupedAuthorsChart("av-chart-authors", a.byAuthorGrouped);
        renderExpandableChart("av-chart-units", a.byUnit, 10, "teal");
        renderExpandableChart("av-chart-articles", a.byArticle, 15, "red");
        renderExpandableChart("av-chart-raions", a.byRaion, 10, "green");
        renderExpandableChart("av-chart-state", a.byState, 10, "orange");
        renderExpandableChart("av-chart-age", a.byAge, 10, "purple");
        renderExpandableChart("av-chart-months", a.byMonth, 12, "green");
    }

    // Загрузка данных
    loadAdminViolations(function () {
        console.log("[app] Админ. правонарушения: " + adminViolations.length);
        buildAVMarkers();
        updateStats();
        // AV article filter filled later (avArticleSelect may not exist yet)
    });

    // ── Камеры на карте ────────────────────────────────────
    var CAMERA_ICON_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#2ecc71">' +
        '<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>' +
        '</svg>';

    var cameraLayer = L.layerGroup();
    map.addLayer(cameraLayer);

    function buildCameraMarkers() {
        cameraLayer.clearLayers();
        cameraPoints.forEach(function (cam) {
            var marker = L.marker([cam.lat, cam.lng], {
                icon: L.divIcon({
                    className: "camera-marker",
                    html: '<div class="camera-marker-icon">' + CAMERA_ICON_SVG + '</div>',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                })
            });

            var tooltipText = (cam.name || "Камера") + (cam.address ? " — " + cam.address : "");
            marker.bindTooltip(tooltipText, {
                direction: "top", offset: [0, -8], className: "marker-tooltip"
            });

            marker.bindPopup(
                '<strong>' + (cam.name || "Камера") + '</strong><br>' +
                (cam.type ? '<em>' + cam.type + '</em><br>' : '') +
                (cam.address ? cam.address : '')
            );

            cameraLayer.addLayer(marker);
        });
        console.log("[map] Камер на карте: " + cameraPoints.length);
    }

    loadCameras(function () {
        buildCameraMarkers();
        updateStats();
    });

    // ── Участковые пункты на карте ──────────────────────────
    var policeLayer = L.layerGroup();
    map.addLayer(policeLayer);

    function buildPoliceMarkers() {
        policeLayer.clearLayers();
        policePoints.forEach(function (p) {
            var marker = L.marker([p.lat, p.lng], {
                icon: L.icon({
                    iconUrl: "images/police-icon.png",
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                    popupAnchor: [0, -12]
                })
            });

            marker.bindTooltip(p.name + (p.address ? " — " + p.address : ""), {
                direction: "top", offset: [0, -15], className: "marker-tooltip"
            });

            marker.bindPopup(
                '<strong>' + p.name + '</strong><br>' +
                (p.address ? p.address + '<br>' : '') +
                'Сотрудников: ' + p.staff
            );

            policeLayer.addLayer(marker);
        });
        console.log("[map] Участковых пунктов на карте: " + policePoints.length);
    }

    loadPoliceStations(function () {
        buildPoliceMarkers();
        updateStats();
    });

    // ── Школы на карте ─────────────────────────────────────
    var SCHOOL_ICON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#ff6b9d"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>';
    var schoolLayer = L.layerGroup();
    map.addLayer(schoolLayer);

    function buildSchoolMarkers() {
        schoolLayer.clearLayers();
        schoolPoints.forEach(function (s) {
            var marker = L.marker([s.lat, s.lng], {
                icon: L.divIcon({
                    className: "school-marker",
                    html: '<div class="school-marker-icon">' + SCHOOL_ICON_SVG + '</div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            });

            marker.bindTooltip(s.name + (s.address ? " — " + s.address : ""), {
                direction: "top", offset: [0, -10], className: "marker-tooltip"
            });

            // Popup: гостевой — только название и адрес; сотрудник — полная информация
            var popupContent;
            if (isStaff) {
                var phones = s.schoolPhones.length ? s.schoolPhones.join(", ") : "—";
                popupContent =
                    '<strong>' + s.name + '</strong><br>' +
                    (s.address ? '<span style="color:#8899b0">📍 ' + s.address + '</span><br>' : '') +
                    '<br><b>Директор:</b> ' + (s.director || "—") + '<br>' +
                    '<b>Тел. школы:</b> ' + phones + '<br>' +
                    '<b>Тел. директора:</b> ' + (s.directorPhone || "—");
            } else {
                popupContent =
                    '<strong>' + s.name + '</strong><br>' +
                    (s.address ? s.address : '');
            }
            marker.bindPopup(popupContent);

            schoolLayer.addLayer(marker);
        });
        console.log("[map] Школ на карте: " + schoolPoints.length);
    }

    loadSchools(function () {
        buildSchoolMarkers();
        updateStats();
    });

    // ── Заведения (бары, пабы, лаунжи) на карте ────────────
    var venueLayer = L.layerGroup();

    function buildVenueMarkers() {
        venueLayer.clearLayers();
        if (typeof venuePoints === "undefined") return;
        venuePoints.forEach(function (v) {
            var icon = L.divIcon({
                className: "venue-marker-wrap",
                html: '<div class="venue-marker">🍸</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            var marker = L.marker([v.lat, v.lng], { icon: icon });
            marker.bindTooltip(v.name, { direction: "top", offset: [0, -14], className: "marker-tooltip" });
            marker.bindPopup(
                '<div style="min-width:160px;">' +
                '<div style="font-weight:700;font-size:14px;color:#e91e63;margin-bottom:4px;">' + v.name + '</div>' +
                '<div style="font-size:12px;color:#888;">' + (v.addr || "") + '</div>' +
                '</div>', { maxWidth: 240 }
            );
            venueLayer.addLayer(marker);
        });
        console.log("[map] Заведений: " + venuePoints.length);
    }
    if (typeof loadVenues === "function") {
        loadVenues(function () { buildVenueMarkers(); });
    } else {
        buildVenueMarkers();
    }

    // ── Административные правонарушения на карте ───────────
    var avLayer = L.layerGroup();
    if (isStaff) map.addLayer(avLayer);

    function _createAVCircle(v) {
        var marker = L.circleMarker([v.lat, v.lng], {
            radius: 5,
            color: "#fff",
            weight: 1.5,
            fillColor: "#e67e22",
            fillOpacity: 0.9
        });
        var fio = [v.lastName, v.firstName, v.patronymic].filter(Boolean).join(" ") || "";
        marker.bindTooltip((v.article || "—") + (fio ? " | " + fio : ""), {
            direction: "top", offset: [0, -8], className: "marker-tooltip"
        });
        marker.bindPopup(
            '<strong>' + (v.article || "—") + '</strong><br>' +
            (fio ? fio + '<br>' : '') +
            (v.place ? v.place + '<br>' : '') +
            (v.regDate ? 'Дата: ' + v.regDate + '<br>' : '') +
            (v.podrazdelenie ? v.podrazdelenie : '')
        );
        return marker;
    }

    function buildAVMarkers() {
        avLayer.clearLayers();
        var added = 0;
        adminViolations.forEach(function (v) {
            if (v.lat === null || v.lng === null) return;
            if (_isHiddenArticle(v.article)) return;
            avLayer.addLayer(_createAVCircle(v));
            added++;
        });
        console.log("[map] АП маркеров на карте: " + added);
    }

    // ── Sidebar period filter (affects crime + AV on map) ───
    var sidebarPeriod = "all";

    function applySidebarPeriod() {
        var cutoff = getPeriodCutoff(sidebarPeriod);

        // Rebuild ЕРДР markers filtered by period
        crimeErdrLayer.clearLayers();
        var crimeFiltered = cutoff ? crimeIncidents.filter(function (c) {
            return new Date(c.regDate) >= cutoff;
        }) : crimeIncidents;
        crimeFiltered.forEach(function (c) {
            if (typeof c.lat !== "number" || isNaN(c.lat)) return;
            if (_isHiddenArticle(c.article)) return;
            if (sidebarCrimeArticle && _extractNum(c.article) !== sidebarCrimeArticle) return;
            var marker = L.circleMarker([c.lat, c.lng], {
                radius: 3.5,
                color: "rgba(255,255,255,0.8)",
                weight: 1,
                fillColor: "#e74c3c",
                fillOpacity: 0.9
            });
            if (isStaff) {
                marker.bindTooltip((c.article || "—") + " | " + (c.street ? "ул. " + c.street : ""), {
                    direction: "top", offset: [0, -8], className: "marker-tooltip"
                });
            } else {
                marker.bindTooltip("Ст. " + (c.article || "—"), {
                    direction: "top", offset: [0, -8], className: "marker-tooltip"
                });
            }
            _attachCrimeHandler(marker, c);
            crimeErdrLayer.addLayer(marker);
        });

        // Rebuild AV markers filtered by period
        avLayer.clearLayers();
        var avFiltered = cutoff ? adminViolations.filter(function (v) {
            return v.regDate && new Date(v.regDate) >= cutoff;
        }) : adminViolations;
        avFiltered.forEach(function (v) {
            if (v.lat === null || v.lng === null) return;
            if (_isHiddenArticle(v.article)) return;
            if (sidebarAvArticle && _extractNum(v.article) !== sidebarAvArticle) return;
            avLayer.addLayer(_createAVCircle(v));
        });

        // Update sidebar counts
        document.getElementById("count-crime").textContent = crimeFiltered.filter(function (c) {
            if (typeof c.lat !== "number" || isNaN(c.lat)) return false;
            if (sidebarCrimeArticle && _extractNum(c.article) !== sidebarCrimeArticle) return false;
            return true;
        }).length;
        document.getElementById("count-av").textContent = avFiltered.filter(function (v) {
            if (v.lat === null) return false;
            if (sidebarAvArticle && _extractNum(v.article) !== sidebarAvArticle) return false;
            return true;
        }).length;
    }

    document.querySelectorAll(".sidebar-period-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".sidebar-period-btn").forEach(function (b) { b.classList.remove("active"); });
            this.classList.add("active");
            sidebarPeriod = this.getAttribute("data-period");
            updatePeriodHint("sidebar-period-hint", sidebarPeriod);
            applySidebarPeriod();
        });
    });

    // ── Фильтр по статьям (в легенде) ─────────────────────────
    var sidebarCrimeArticle = "";
    var sidebarAvArticle = "";
    var crimeArticleSelect = document.getElementById("sidebar-crime-article");
    var avArticleSelect = document.getElementById("sidebar-av-article");
    var crimeArticleDiv = document.getElementById("crime-article-filter");
    var avArticleDiv = document.getElementById("av-article-filter");

    function _extractNum(art) {
        var m = String(art || "").match(/(\d{2,4})/);
        return m ? m[1] : "";
    }

    function _buildArticleOptions(items, selectEl) {
        var arts = {};
        items.forEach(function (c) {
            if (!c.article) return;
            var num = _extractNum(c.article);
            if (!num) return;
            if (!arts[num]) arts[num] = 0;
            arts[num]++;
        });
        var list = Object.keys(arts).map(function (n) { return { num: n, count: arts[n] }; })
            .sort(function (a, b) { return b.count - a.count; });
        selectEl.innerHTML = '<option value="">Все статьи (' + items.length + ')</option>';
        list.forEach(function (a) {
            var hidden = !!HIDDEN_MAP_ARTICLES[parseInt(a.num, 10)];
            var label = 'ст. ' + a.num + ' (' + a.count + ')' + (hidden ? ' — нет на карте' : '');
            selectEl.innerHTML += '<option value="' + a.num + '"' + (hidden ? ' style="color:#8892b0"' : '') + '>' + label + '</option>';
        });
    }

    // Заполнить фильтры после загрузки данных
    onCrimesReady(function () {
        if (crimeArticleSelect) _buildArticleOptions(crimeIncidents, crimeArticleSelect);
    });
    onAdminViolationsReady(function () {
        if (avArticleSelect) _buildArticleOptions(adminViolations, avArticleSelect);
    });

    // Показ/скрытие фильтра при переключении чекбокса категории
    document.querySelectorAll("[data-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
            var f = this.getAttribute("data-filter");
            if (f === "crime" && crimeArticleDiv && isStaff) {
                crimeArticleDiv.style.display = this.checked ? "" : "none";
                if (!this.checked) { sidebarCrimeArticle = ""; if (crimeArticleSelect) crimeArticleSelect.value = ""; }
            }
            if (f === "admin-violations" && avArticleDiv && isStaff) {
                avArticleDiv.style.display = this.checked ? "" : "none";
                if (!this.checked) { sidebarAvArticle = ""; if (avArticleSelect) avArticleSelect.value = ""; }
            }
        });
    });

    // Показать фильтры при загрузке если чекбоксы включены (только для staff)
    setTimeout(function () {
        if (!isStaff) return;
        var crimeCb = document.querySelector("[data-filter='crime']");
        var avCb = document.querySelector("[data-filter='admin-violations']");
        if (crimeCb && crimeCb.checked && crimeArticleDiv) crimeArticleDiv.style.display = "";
        if (avCb && avCb.checked && avArticleDiv) avArticleDiv.style.display = "";
    }, 100);

    if (crimeArticleSelect) {
        crimeArticleSelect.addEventListener("change", function () {
            sidebarCrimeArticle = this.value;
            applySidebarPeriod();
        });
    }
    if (avArticleSelect) {
        avArticleSelect.addEventListener("change", function () {
            sidebarAvArticle = this.value;
            applySidebarPeriod();
        });
    }

    // ── XLSX Export (SheetJS) ────────────────────────────────
    function _exportXlsx(headers, rows, filename) {
        var data = [headers].concat(rows);
        var ws = XLSX.utils.aoa_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, filename);
    }

    // ЕРДР — экспорт списка
    document.getElementById("crime-export-xlsx").addEventListener("click", function () {
        var headers = ["№", "ЕРДР", "Дата регистрации", "Статья", "Орган", "Адрес", "Место", "Общ. место", "Дата совершения", "Описание"];
        var rows = crimeIncidents.map(function (c, i) {
            return [i + 1, c.erdr || "", formatCrimeDate(c.regDate), c.article || "", c.organ || "",
                    (c.street || "") + " " + (c.place || ""), c.placeType || "", c.isPublic ? "Да" : "Нет",
                    formatDateOnly(c.crimeDate) + " " + formatTimeOnly(c.crimeTime), c.description || ""];
        });
        _exportXlsx(headers, rows, "ERDR_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    });

    // АП — экспорт списка
    document.getElementById("av-export-xlsx").addEventListener("click", function () {
        var headers = ["№", "Номер", "Дата", "Статья", "Орган", "Подразделение", "ФИО инспектора", "Место", "ФИО нарушителя", "Фабула"];
        var rows = adminViolations.map(function (v, i) {
            return [i + 1, v.materialNumber || "", formatCrimeDate(v.regDate), v.article || "", v.organ || "",
                    v.podrazdelenie || "", v.authorFio || "", v.place || "",
                    [v.lastName, v.firstName, v.patronymic].filter(Boolean).join(" "), v.fabula || ""];
        });
        _exportXlsx(headers, rows, "Admin_violations_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    });

    // ЕРДР Аналитика — экспорт (статьи + зоны + лица)
    document.getElementById("crime-analytics-export-xlsx").addEventListener("click", function () {
        var a = window._lastAnalysis;
        if (!a) { alert("Нет данных"); return; }
        var headers = ["Статья", "Кол-во", "Доля %"];
        var rows = (a.byArticle || []).map(function (art) {
            return [art.label, art.count, a.total > 0 ? Math.round(art.count / a.total * 100) : 0];
        });
        _exportXlsx(headers, rows, "ERDR_analytics_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    });

    // АП Аналитика — экспорт
    document.getElementById("av-analytics-export-xlsx").addEventListener("click", function () {
        var headers = ["Статья", "Кол-во"];
        var arts = {};
        adminViolations.forEach(function (v) {
            if (!v.article) return;
            var num = _extractNum(v.article);
            if (!num) return;
            arts[num] = (arts[num] || 0) + 1;
        });
        var rows = Object.keys(arts).sort(function (a, b) { return arts[b] - arts[a]; })
            .map(function (n) { return ["ст. " + n, arts[n]]; });
        _exportXlsx(headers, rows, "AV_analytics_" + new Date().toISOString().slice(0, 10) + ".xlsx");
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

        // Focus on akimat suggestion (accepted / resolved) by id+coords
        var focusId = params.get("focus");
        if (focusId) {
            var fid = parseInt(focusId, 10);
            var flat = parseFloat(params.get("lat"));
            var flng = parseFloat(params.get("lng"));
            urlPointChecked = true;
            // Попробуем открыть popup маркера; если слой ещё не готов — просто центрируем карту.
            if (!isNaN(flat) && !isNaN(flng)) {
                map.setView([flat, flng], 17);
            }
            var tries = 0;
            var tryFocus = function () {
                if (typeof focusSuggestionOnMap === "function" && focusSuggestionOnMap(fid)) return;
                if (++tries < 20) setTimeout(tryFocus, 200);
            };
            tryFocus();
            return;
        }

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
    //  STAFF / GUEST MODE
    // ═══════════════════════════════════════════════════════
    function applyMode() {
        var isGuest = !isStaff && !isAkimat;
        document.querySelectorAll(".staff-only").forEach(function (el) {
            el.style.display = isStaff ? "" : "none";
        });
        document.querySelectorAll(".guest-only").forEach(function (el) {
            el.style.display = isGuest ? "" : "none";
        });
        document.querySelectorAll(".akimat-only").forEach(function (el) {
            el.style.display = isAkimat ? "" : "none";
        });
        document.querySelectorAll(".no-akimat").forEach(function (el) {
            el.style.display = isAkimat ? "none" : "";
        });
        // For akimat: also hide crime stat row + remove crime layer
        if (isAkimat) {
            var crimeRow = document.querySelector('#count-crime');
            if (crimeRow && crimeRow.closest('.stat-row')) crimeRow.closest('.stat-row').style.display = "none";
            if (typeof crimeErdrLayer !== "undefined" && map.hasLayer(crimeErdrLayer)) map.removeLayer(crimeErdrLayer);
        }

        // Staff (Прокуратура): all category layers OFF by default — user enables manually
        if (isStaff && !window._staffInitDone) {
            window._staffInitDone = true;
            document.querySelectorAll('[data-filter]').forEach(function (cb) {
                cb.checked = false;
            });
            // Remove all category layers from the map
            Object.keys(layers).forEach(function (cat) {
                if (map.hasLayer(layers[cat])) map.removeLayer(layers[cat]);
            });
            if (map.hasLayer(crimeErdrLayer)) map.removeLayer(crimeErdrLayer);
            if (typeof avLayer !== "undefined" && map.hasLayer(avLayer)) map.removeLayer(avLayer);
            if (typeof cameraLayer !== "undefined" && map.hasLayer(cameraLayer)) map.removeLayer(cameraLayer);
            if (typeof policeLayer !== "undefined" && map.hasLayer(policeLayer)) map.removeLayer(policeLayer);
            if (typeof schoolLayer !== "undefined" && map.hasLayer(schoolLayer)) map.removeLayer(schoolLayer);
            if (typeof venueLayer !== "undefined" && map.hasLayer(venueLayer)) map.removeLayer(venueLayer);
        } else if (!isStaff) {
            var crimeCb = document.querySelector('[data-filter="crime"]');
            if (!crimeCb || crimeCb.checked) map.addLayer(crimeErdrLayer);
            map.removeLayer(avLayer);
            map.removeLayer(cameraLayer);
        }

        // Перестроить попапы школ (разный контент для гостя/сотрудника)
        if (schoolPoints.length > 0) buildSchoolMarkers();

        // Обновить слой принятых заявок на карте
        if (typeof rebuildAcceptedSuggestionsLayer === "function") {
            rebuildAcceptedSuggestionsLayer();
        }
    }

    // ═══════════════════════════════════════════════════════
    //  AUTH: read role from localStorage (set on /login page)
    // ═══════════════════════════════════════════════════════
    var authRole = localStorage.getItem("atyrau-auth-role");
    if (authRole === "staff") isStaff = true;
    else if (authRole === "akimat") isAkimat = true;

    // Apply mode on load
    applyMode();

    // Staff logout → clear auth + reload
    document.getElementById("staff-logout-btn").addEventListener("click", function () {
        localStorage.removeItem("atyrau-auth-role");
        isStaff = false;
        if (isAdmin) exitAdmin();
        window.location.href = "/";
    });

    // Akimat logout → clear auth + reload
    document.getElementById("akimat-logout-btn").addEventListener("click", function () {
        localStorage.removeItem("atyrau-auth-role");
        isAkimat = false;
        window.location.href = "/";
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

    var adminToggleBtn = document.getElementById("admin-toggle-btn");
    if (adminToggleBtn) {
        adminToggleBtn.addEventListener("click", function () {
            if (isAdmin) exitAdmin(); else openLoginModal();
        });
    }

    // Автовход из /admin
    if (sessionStorage.getItem("atyrau-admin-enter") === "yes") {
        sessionStorage.removeItem("atyrau-admin-enter");
        setTimeout(function () { enterAdmin(); }, 500);
    }

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
        if (adminToggleBtn) { adminToggleBtn.setAttribute("data-i18n", "admin_exit"); adminToggleBtn.textContent = t("admin_exit"); }
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
        if (adminToggleBtn) { adminToggleBtn.setAttribute("data-i18n", "admin_login"); adminToggleBtn.textContent = t("admin_login"); }
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

        // На карте "pending" точки видны только администратору (устаревший режим)
        if (!isAdmin) { updatePendingCount(); return; }

        mapSuggestions.forEach(function (s) {
            // Показываем только заявки со статусом pending (новые)
            if (s.status && s.status !== "pending") return;

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
        if (!el) return;
        var pending = mapSuggestions.filter(function (s) {
            return !s.status || s.status === "pending";
        }).length;
        el.textContent = pending;
    }

    onSuggestionsChanged(buildPendingMarkers);

    // Suggest button click → show intro modal first
    var suggestIntroOverlay = document.getElementById("suggest-intro-overlay");

    suggestBtn.addEventListener("click", function () {
        if (isSuggestPicking) {
            cancelSuggestPicking();
            return;
        }
        if (suggestIntroOverlay) {
            suggestIntroOverlay.classList.remove("hidden");
        } else {
            _startSuggestPicking();
        }
    });

    function _startSuggestPicking() {
        isSuggestPicking = true;
        suggestBtn.classList.add("picking");
        suggestBtn.textContent = t("suggest_pick_location");
        map.getContainer().style.cursor = "crosshair";
        closeMobileSidebar();
    }

    if (suggestIntroOverlay) {
        document.getElementById("suggest-intro-start").addEventListener("click", function () {
            suggestIntroOverlay.classList.add("hidden");
            _startSuggestPicking();
        });
        document.getElementById("suggest-intro-close").addEventListener("click", function () {
            suggestIntroOverlay.classList.add("hidden");
        });
        suggestIntroOverlay.addEventListener("click", function (e) {
            if (e.target === suggestIntroOverlay) suggestIntroOverlay.classList.add("hidden");
        });
    }

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

    var suggestPhotoBase64 = null;

    function openSuggestModal() {
        suggestCoords.textContent = suggestLat.toFixed(4) + ", " + suggestLng.toFixed(4);
        document.getElementById("suggest-name").value = "";
        document.getElementById("suggest-contact").value = "";
        document.getElementById("suggest-desc").value = "";
        suggestCategory = "blind-spots";
        document.querySelectorAll("#suggest-cat-selector .cat-btn").forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-cat") === "blind-spots");
        });
        // Reset photo
        suggestPhotoBase64 = null;
        var photoInput = document.getElementById("suggest-photo-input");
        if (photoInput) photoInput.value = "";
        var preview = document.getElementById("suggest-photo-preview");
        if (preview) { preview.innerHTML = ""; preview.classList.add("hidden"); }
        suggestSubmit.disabled = false;
        suggestOverlay.classList.remove("hidden");
    }

    // Photo compression helper: resize to max 800px, JPEG quality 0.7
    function compressPhoto(file, maxSize, quality) {
        return new Promise(function (resolve, reject) {
            if (!file) return reject(new Error("No file"));
            var reader = new FileReader();
            reader.onload = function (e) {
                var img = new Image();
                img.onload = function () {
                    var w = img.width, h = img.height;
                    if (w > h && w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
                    var canvas = document.createElement("canvas");
                    canvas.width = w; canvas.height = h;
                    var ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL("image/jpeg", quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Photo input handler
    document.getElementById("suggest-photo-input").addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        compressPhoto(file, 800, 0.7).then(function (base64) {
            suggestPhotoBase64 = base64;
            var preview = document.getElementById("suggest-photo-preview");
            preview.innerHTML = '<img src="' + base64 + '" alt="preview" />' +
                '<button type="button" class="suggest-photo-remove" aria-label="Удалить">&times;</button>';
            preview.classList.remove("hidden");
            preview.querySelector(".suggest-photo-remove").addEventListener("click", function () {
                suggestPhotoBase64 = null;
                document.getElementById("suggest-photo-input").value = "";
                preview.innerHTML = "";
                preview.classList.add("hidden");
            });
        }).catch(function (err) {
            console.warn("[photo] compress error", err);
            alert("Ошибка загрузки фото");
        });
    });

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
        if (!suggestPhotoBase64) {
            alert(t("suggest_photo_required"));
            return;
        }

        var suggestion = {
            id: getNextSuggestionId(),
            lat: suggestLat,
            lng: suggestLng,
            category: suggestCategory,
            name: name,
            contact: contact,
            description: desc,
            photo: suggestPhotoBase64,
            status: "pending",
            created: new Date().toISOString()
        };

        saveSuggestion(suggestion);
        closeSuggestModal();

        // Show success toast
        var toast = document.createElement("div");
        toast.className = "suggest-toast";
        toast.textContent = t("suggest_success");
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 4500);
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

    // ═══════════════════════════════════════════════════════
    //  AKIMAT / PROSECUTOR: APPLICATIONS WORKFLOW
    // ═══════════════════════════════════════════════════════
    var SLA_DAYS = 15;

    function escHtml(str) {
        var d = document.createElement("div");
        d.textContent = str == null ? "" : String(str);
        return d.innerHTML;
    }

    function _fmtDMY(d) {
        if (!d) return "—";
        var dt = new Date(d);
        if (isNaN(dt.getTime())) return "—";
        var dd = String(dt.getDate()).padStart(2, "0");
        var mm = String(dt.getMonth() + 1).padStart(2, "0");
        var yy = dt.getFullYear();
        return dd + "." + mm + "." + yy;
    }

    function _daysDiff(a, b) {
        return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
    }

    /** Вычислить SLA-статус (осталось дней до 15-дневного ответа) */
    function calcSLA(createdISO, status, respondedISO) {
        var created = new Date(createdISO);
        var now = new Date();
        var deadline = new Date(created.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);

        // Если уже ответили — считаем как "отвечено"
        if (status && status !== "pending") {
            var respondedAt = respondedISO ? new Date(respondedISO) : now;
            var withinSla = respondedAt <= deadline;
            return {
                daysLeft: null,
                responded: true,
                withinSla: withinSla,
                color: withinSla ? "#27ae60" : "#8e0000",
                label: t("sla_responded")
            };
        }

        var daysLeft = _daysDiff(now, deadline);
        var color, label;
        if (daysLeft < 0) {
            color = "#8e0000";
            label = t("sla_overdue") + " " + Math.abs(daysLeft) + " " + t("akimat_days_short");
        } else if (daysLeft < 5) {
            color = "#e74c3c";
            label = t("sla_days_left") + " " + daysLeft + " " + t("akimat_days_short");
        } else if (daysLeft < 10) {
            color = "#e67e22";
            label = t("sla_days_left") + " " + daysLeft + " " + t("akimat_days_short");
        } else {
            color = "#27ae60";
            label = t("sla_days_left") + " " + daysLeft + " " + t("akimat_days_short");
        }
        return { daysLeft: daysLeft, responded: false, withinSla: daysLeft >= 0, color: color, label: label };
    }

    function _catBadge(cat) {
        var info = CATEGORIES[cat];
        if (!info) return escHtml(cat);
        return '<span class="akimat-cat-badge" style="background:' + info.color + ';">' + t(info.badgeKey) + '</span>';
    }

    function _slaBadgeHtml(s) {
        var sla = calcSLA(s.created, s.status, s.akimatResponseAt);
        return '<span class="sla-badge" style="background:' + sla.color + ';">' + escHtml(sla.label) + '</span>';
    }

    function _statusBadge(status) {
        var key = "status_pending";
        if (status === "accepted") key = "status_accepted";
        else if (status === "rejected") key = "status_rejected";
        else if (status === "resolved") key = "status_resolved";
        return '<span class="status-badge status-' + status + '">' + escHtml(t(key)) + '</span>';
    }

    // ── Pending suggestion count (all suggestions with status pending) ──
    function _updatePendingCount() {
        var el = document.getElementById("count-pending");
        if (!el) return;
        var pending = mapSuggestions.filter(function (s) {
            return !s.status || s.status === "pending";
        }).length;
        el.textContent = pending;
    }

    // ══════════════════════════════════════════════════════
    //  Accepted applications on map (as category markers)
    // ══════════════════════════════════════════════════════
    var acceptedAppsLayer = L.layerGroup();
    map.addLayer(acceptedAppsLayer);

    function _createInProgressIcon(category, resolved) {
        var info = CATEGORIES[category] || { color: "#888" };
        var bg = resolved ? "#27ae60" : info.color;
        var cls = resolved ? "in-progress-marker is-resolved" : "in-progress-marker";
        var icon = resolved ? "✓" : "⚒";
        var pulse = resolved ? "" : '<span class="in-progress-pulse" style="background:' + bg + ';"></span>';
        var html = '<div class="' + cls + '" style="background:' + bg + ';">' +
                    pulse +
                    '<span class="in-progress-icon">' + icon + '</span>' +
                   '</div>';
        return L.divIcon({
            className: "in-progress-marker-wrap",
            html: html,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    }

    function rebuildAcceptedSuggestionsLayer() {
        if (!acceptedAppsLayer) return;
        acceptedAppsLayer.clearLayers();
        var inWork = mapSuggestions.filter(function (s) {
            return s.status === "accepted" || s.status === "resolved";
        });
        inWork.forEach(function (s) {
            var resolved = s.status === "resolved";
            var marker = L.marker([s.lat, s.lng], {
                icon: _createInProgressIcon(s.category, resolved)
            });
            var photoHtml = s.photo ? '<div class="popup-photo"><img src="' + s.photo + '" alt="" /></div>' : '';
            var resolvedPhotoHtml = s.resolvePhoto
                ? '<div class="popup-row"><strong>' + t("akimat_resolve_photo_label") + '</strong></div>' +
                  '<div class="popup-photo"><img src="' + s.resolvePhoto + '" alt="" /></div>'
                : '';
            var publicInfo = '';
            if (isStaff || isAkimat) {
                publicInfo = '<div class="popup-row"><strong>' + t("suggest_from") + '</strong> ' + escHtml(s.name) + '</div>' +
                             '<div class="popup-row"><strong>' + t("suggest_contact_label") + '</strong> ' + escHtml(s.contact) + '</div>';
            }
            var statusBadge = resolved
                ? '<span class="status-badge status-resolved">' + t("status_resolved") + '</span>'
                : '<span class="status-badge status-accepted">' + t("badge_in_progress") + '</span>';
            var resolvedRow = resolved
                ? '<div class="popup-row"><strong>' + t("akimat_resolved_on") + '</strong> ' + _fmtDMY(s.resolvedAt) + '</div>'
                : '<div class="popup-row"><strong>' + t("akimat_accepted_on") + '</strong> ' + _fmtDMY(s.akimatResponseAt) + '</div>' +
                  '<div class="popup-row"><strong>' + t("akimat_promised") + '</strong> ' + escHtml(s.promisedDays) + ' ' + t("akimat_days_short") + '</div>';
            var popup = '<div class="in-progress-popup">' +
                '<div class="popup-header">' + _catBadge(s.category) + ' ' + statusBadge + '</div>' +
                photoHtml +
                '<div class="popup-row">' + escHtml(s.description) + '</div>' +
                publicInfo +
                resolvedRow +
                resolvedPhotoHtml +
            '</div>';
            marker.bindPopup(popup, { maxWidth: 280 });
            var tipLabel = resolved ? t("status_resolved") : t("badge_in_progress");
            marker.bindTooltip(tipLabel + ": " + escHtml(s.description).slice(0, 40), {
                direction: "top", offset: [0, -14], className: "marker-tooltip"
            });
            marker._suggestionId = s.id;
            acceptedAppsLayer.addLayer(marker);
        });
    }

    // Открыть popup конкретной заявки (используется при переходе с /akimat)
    function focusSuggestionOnMap(id) {
        if (!acceptedAppsLayer) return false;
        var found = null;
        acceptedAppsLayer.eachLayer(function (layer) {
            if (layer._suggestionId === id) found = layer;
        });
        if (!found) return false;
        var ll = found.getLatLng();
        map.setView([ll.lat, ll.lng], 17);
        setTimeout(function () { found.openPopup(); }, 400);
        return true;
    }

    // ══════════════════════════════════════════════════════
    //  Prosecutor Monitoring Panel
    // ══════════════════════════════════════════════════════
    var prokOverlay = document.getElementById("prok-monitor-overlay");
    var prokBody    = document.getElementById("prok-monitor-body");
    var prokFilter  = document.getElementById("prok-filter-status");

    document.getElementById("prok-monitor-btn").addEventListener("click", function () {
        renderProkMonitor();
        prokOverlay.classList.remove("hidden");
    });
    document.getElementById("prok-monitor-close").addEventListener("click", function () {
        prokOverlay.classList.add("hidden");
    });
    prokOverlay.addEventListener("click", function (e) {
        if (e.target === prokOverlay) prokOverlay.classList.add("hidden");
    });
    prokFilter.addEventListener("change", renderProkMonitor);

    function renderProkMonitor() {
        if (!prokBody) return;
        var filterVal = prokFilter.value || "";
        var items = mapSuggestions.filter(function (s) {
            var st = s.status || "pending";
            return !filterVal || st === filterVal;
        }).sort(function (a, b) {
            // Сначала просроченные, потом по остатку дней, потом по дате
            var sa = calcSLA(a.created, a.status, a.akimatResponseAt);
            var sb = calcSLA(b.created, b.status, b.akimatResponseAt);
            if (!sa.responded && !sb.responded) return sa.daysLeft - sb.daysLeft;
            if (!sa.responded) return -1;
            if (!sb.responded) return 1;
            return new Date(b.created) - new Date(a.created);
        });

        if (items.length === 0) {
            prokBody.innerHTML = '<p class="akimat-empty">' + escHtml(t("prok_no_applications")) + '</p>';
            return;
        }

        prokBody.innerHTML = items.map(function (s) {
            var status = s.status || "pending";
            var sla = calcSLA(s.created, status, s.akimatResponseAt);
            var slaBadge = '<span class="sla-badge" style="background:' + sla.color + ';">' + escHtml(sla.label) + '</span>';
            var photoHtml = s.photo ? '<div class="prok-row-photo"><img src="' + s.photo + '" alt="" /></div>' : '<div class="prok-row-photo empty">—</div>';

            var respText = '';
            if (status === "accepted") {
                respText = '<strong>' + t("akimat_accepted_on") + '</strong> ' + _fmtDMY(s.akimatResponseAt) +
                    ' · <strong>' + t("akimat_promised") + '</strong> ' + escHtml(s.promisedDays) + ' ' + t("akimat_days_short");
            } else if (status === "rejected") {
                respText = '<strong>' + t("akimat_rejected_on") + '</strong> ' + _fmtDMY(s.akimatResponseAt) +
                    ' · <strong>' + t("akimat_reason") + '</strong> ' + escHtml(s.rejectReason || "");
            } else if (status === "resolved") {
                respText = '<strong>' + t("akimat_resolved_on") + '</strong> ' + _fmtDMY(s.resolvedAt);
            } else {
                respText = '<em style="color:#8892b0;">' + t("status_pending") + '</em>';
            }

            return '<div class="prok-row status-' + status + '">' +
                photoHtml +
                '<div class="prok-row-main">' +
                    '<div class="prok-row-head">' +
                        _catBadge(s.category) + ' ' + _statusBadge(status) + ' ' + slaBadge +
                    '</div>' +
                    '<div class="prok-row-desc">' + escHtml(s.description) + '</div>' +
                    '<div class="prok-row-meta">' +
                        '<strong>' + t("suggest_from") + '</strong> ' + escHtml(s.name) + ' · ' +
                        '<strong>' + t("suggest_contact_label") + '</strong> ' + escHtml(s.contact) + ' · ' +
                        '<strong>' + t("prok_submitted_on") + '</strong> ' + _fmtDMY(s.created) +
                    '</div>' +
                    '<div class="prok-row-response">' + respText + '</div>' +
                '</div>' +
                '<button class="btn-secondary prok-row-show" data-id="' + s.id + '">' + t("suggest_show_on_map") + '</button>' +
            '</div>';
        }).join("");

        prokBody.querySelectorAll(".prok-row-show").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = parseInt(this.getAttribute("data-id"), 10);
                var s = mapSuggestions.find(function (x) { return x.id === id; });
                if (s) {
                    prokOverlay.classList.add("hidden");
                    map.setView([s.lat, s.lng], 17);
                }
            });
        });
    }

    // ── Listen to suggestions changes: update map + panels + counters ──
    onSuggestionsChanged(function () {
        rebuildAcceptedSuggestionsLayer();
        _updatePendingCount();
        if (!prokOverlay.classList.contains("hidden")) renderProkMonitor();
    });

})();
