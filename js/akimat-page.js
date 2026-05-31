// ══════════════════════════════════════════════════════════════
//  AKIMAT DASHBOARD (dedicated page)
// ══════════════════════════════════════════════════════════════
(function () {
    "use strict";

    // ── Auth gate ──
    if (localStorage.getItem("atyrau-auth-role") !== "akimat") {
        window.location.href = "/login";
        return;
    }

    // ── Lang init ──
    (function () {
        var saved = localStorage.getItem("atyrau-map-lang") || "ru";
        setLanguage(saved);
    })();
    document.querySelectorAll(".lang-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            setLanguage(this.getAttribute("data-lang"));
            renderPanel();
        });
    });

    // ── Logout ──
    document.getElementById("akimat-logout").addEventListener("click", function () {
        localStorage.removeItem("atyrau-auth-role");
        window.location.href = "/";
    });

    // ── Shared helpers (mirroring app.js) ──
    var CATEGORIES = {
        "crime":       { color: "#e74c3c", badgeKey: "badge_crime" },
        "blind-spots": { color: "#3498db", badgeKey: "badge_blind" },
        "abandoned":   { color: "#8e44ad", badgeKey: "badge_abandoned" },
        "unlit":       { color: "#f39c12", badgeKey: "badge_unlit" }
    };
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
        return dd + "." + mm + "." + dt.getFullYear();
    }
    function _daysDiff(a, b) {
        return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
    }
    function calcSLA(createdISO, status, respondedISO) {
        var created = new Date(createdISO);
        var now = new Date();
        var deadline = new Date(created.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);
        if (status && status !== "pending") {
            var respondedAt = respondedISO ? new Date(respondedISO) : now;
            var withinSla = respondedAt <= deadline;
            return {
                daysLeft: null, responded: true, withinSla: withinSla,
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

    // ── Panel state ──
    var currentTab = "new";
    var currentAppId = null;
    var panelBody = document.getElementById("akimat-panel-body");
    var acceptOverlay = document.getElementById("akimat-accept-overlay");
    var rejectOverlay = document.getElementById("akimat-reject-overlay");
    var resolveOverlay = document.getElementById("akimat-resolve-overlay");
    var resolvePhotoBase64 = null;

    document.querySelectorAll(".akimat-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
            currentTab = this.getAttribute("data-tab");
            document.querySelectorAll(".akimat-tab").forEach(function (b) { b.classList.remove("active"); });
            this.classList.add("active");
            renderPanel();
        });
    });

    function _filterForTab(tab) {
        return mapSuggestions.filter(function (s) {
            var st = s.status || "pending";
            if (tab === "new") return st === "pending";
            if (tab === "inprogress") return st === "accepted";
            if (tab === "archive") return st === "rejected" || st === "resolved";
            return false;
        }).sort(function (a, b) { return new Date(b.created) - new Date(a.created); });
    }

    function renderPanel() {
        var items = _filterForTab(currentTab);
        if (items.length === 0) {
            var emptyKey = "akimat_no_new";
            if (currentTab === "inprogress") emptyKey = "akimat_no_inprogress";
            else if (currentTab === "archive") emptyKey = "akimat_no_archive";
            panelBody.innerHTML = '<p class="akimat-empty">' + escHtml(t(emptyKey)) + '</p>';
            return;
        }
        panelBody.innerHTML = items.map(_renderCard).join("");
        panelBody.querySelectorAll("[data-action]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var action = this.getAttribute("data-action");
                var id = parseInt(this.getAttribute("data-id"), 10);
                if (action === "accept") openAccept(id);
                else if (action === "reject") openReject(id);
                else if (action === "resolve") openResolve(id);
                else if (action === "show-on-map") {
                    var s = mapSuggestions.find(function (x) { return x.id === id; });
                    if (s) {
                        window.location.href = "/?focus=" + s.id + "&lat=" + s.lat + "&lng=" + s.lng;
                    }
                }
            });
        });
    }

    function _renderCard(s) {
        var status = s.status || "pending";
        var photoHtml = s.photo ? '<div class="akimat-card-photo"><img src="' + s.photo + '" alt="фото" /></div>' : '';
        var slaOrPromised = "";
        if (status === "pending") {
            slaOrPromised = _slaBadgeHtml(s);
        } else if (status === "accepted") {
            slaOrPromised = '<span class="status-badge" style="background:#3498db;">' + t("akimat_promised") + " " + escHtml(s.promisedDays || "—") + " " + t("akimat_days_short") + '</span>';
        }
        var responseHtml = "";
        if (status === "accepted") {
            responseHtml = '<div class="akimat-card-response"><strong>' + t("akimat_accepted_on") + '</strong> ' + _fmtDMY(s.akimatResponseAt) +
                ' · <strong>' + t("akimat_promised") + '</strong> ' + escHtml(s.promisedDays) + ' ' + t("akimat_days_short") + '</div>';
        } else if (status === "rejected") {
            responseHtml = '<div class="akimat-card-response"><strong>' + t("akimat_rejected_on") + '</strong> ' + _fmtDMY(s.akimatResponseAt) +
                '<br><strong>' + t("akimat_reason") + '</strong> ' + escHtml(s.rejectReason || "") + '</div>';
        } else if (status === "resolved") {
            var resolvedPhoto = s.resolvePhoto
                ? '<div class="akimat-card-photo"><img src="' + s.resolvePhoto + '" alt="фото устранения" /></div>'
                : '';
            responseHtml = '<div class="akimat-card-response"><strong>' + t("akimat_resolved_on") + '</strong> ' + _fmtDMY(s.resolvedAt) + '</div>' +
                resolvedPhoto;
        }
        var actions = "";
        if (status === "pending") {
            actions = '<button class="btn-primary" data-action="accept" data-id="' + s.id + '">' + t("akimat_accept") + '</button>' +
                      '<button class="btn-danger" data-action="reject" data-id="' + s.id + '">' + t("akimat_reject") + '</button>';
        } else if (status === "accepted") {
            actions = '<button class="btn-success" data-action="resolve" data-id="' + s.id + '">' + t("akimat_resolve") + '</button>';
        }
        actions += '<button class="btn-secondary" data-action="show-on-map" data-id="' + s.id + '">' + t("suggest_show_on_map") + '</button>';

        return '<div class="akimat-card status-' + status + '">' +
            '<div class="akimat-card-top">' +
                '<div class="akimat-card-meta">' +
                    _catBadge(s.category) + ' ' + _statusBadge(status) + ' ' + slaOrPromised +
                '</div>' +
                '<div class="akimat-card-date">' + t("prok_submitted_on") + ' ' + _fmtDMY(s.created) + '</div>' +
            '</div>' +
            photoHtml +
            '<div class="akimat-card-body">' +
                '<div class="akimat-card-field"><strong>' + t("suggest_from") + '</strong> ' + escHtml(s.name) + '</div>' +
                '<div class="akimat-card-field"><strong>' + t("suggest_contact_label") + '</strong> <a href="tel:' + escHtml(s.contact) + '">' + escHtml(s.contact) + '</a></div>' +
                '<div class="akimat-card-field"><strong>' + t("crime_address") + ':</strong> ' + s.lat.toFixed(4) + ', ' + s.lng.toFixed(4) + '</div>' +
                '<div class="akimat-card-desc">' + escHtml(s.description) + '</div>' +
            '</div>' +
            responseHtml +
            '<div class="akimat-card-actions">' + actions + '</div>' +
        '</div>';
    }

    // ── Accept/Reject/Resolve ──
    function openAccept(id) {
        currentAppId = id;
        document.getElementById("akimat-accept-days").value = 30;
        acceptOverlay.classList.remove("hidden");
    }
    function openReject(id) {
        currentAppId = id;
        document.getElementById("akimat-reject-reason").value = "";
        rejectOverlay.classList.remove("hidden");
    }
    document.getElementById("akimat-accept-close").addEventListener("click", function () { acceptOverlay.classList.add("hidden"); });
    document.getElementById("akimat-accept-cancel").addEventListener("click", function () { acceptOverlay.classList.add("hidden"); });
    acceptOverlay.addEventListener("click", function (e) { if (e.target === acceptOverlay) acceptOverlay.classList.add("hidden"); });
    document.getElementById("akimat-reject-close").addEventListener("click", function () { rejectOverlay.classList.add("hidden"); });
    document.getElementById("akimat-reject-cancel").addEventListener("click", function () { rejectOverlay.classList.add("hidden"); });
    rejectOverlay.addEventListener("click", function (e) { if (e.target === rejectOverlay) rejectOverlay.classList.add("hidden"); });

    document.getElementById("akimat-accept-submit").addEventListener("click", function () {
        var days = parseInt(document.getElementById("akimat-accept-days").value, 10);
        if (!days || days < 1) { document.getElementById("akimat-accept-days").focus(); return; }
        var s = mapSuggestions.find(function (x) { return x.id === currentAppId; });
        if (!s) return;
        s.status = "accepted";
        s.promisedDays = days;
        s.akimatResponseAt = new Date().toISOString();
        saveSuggestion(s);
        acceptOverlay.classList.add("hidden");
    });
    document.getElementById("akimat-reject-submit").addEventListener("click", function () {
        var reason = document.getElementById("akimat-reject-reason").value.trim();
        if (!reason) { document.getElementById("akimat-reject-reason").focus(); return; }
        var s = mapSuggestions.find(function (x) { return x.id === currentAppId; });
        if (!s) return;
        s.status = "rejected";
        s.rejectReason = reason;
        s.akimatResponseAt = new Date().toISOString();
        saveSuggestion(s);
        rejectOverlay.classList.add("hidden");
    });

    // ── Resolve flow: требует фото устранения ──
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
                    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL("image/jpeg", quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function _resetResolveModal() {
        resolvePhotoBase64 = null;
        var preview = document.getElementById("akimat-resolve-photo-preview");
        if (preview) { preview.innerHTML = ""; preview.classList.add("hidden"); }
        var input = document.getElementById("akimat-resolve-photo-input");
        if (input) input.value = "";
        var err = document.getElementById("akimat-resolve-err");
        if (err) err.textContent = "";
    }

    function openResolve(id) {
        currentAppId = id;
        _resetResolveModal();
        resolveOverlay.classList.remove("hidden");
    }

    var resolvePickBtn   = document.getElementById("akimat-resolve-photo-pick");
    var resolvePhotoIn   = document.getElementById("akimat-resolve-photo-input");
    var resolvePreview   = document.getElementById("akimat-resolve-photo-preview");
    var resolveErrEl     = document.getElementById("akimat-resolve-err");

    resolvePickBtn.addEventListener("click", function () { resolvePhotoIn.click(); });

    resolvePhotoIn.addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        resolveErrEl.textContent = "";
        compressPhoto(file, 900, 0.75).then(function (base64) {
            resolvePhotoBase64 = base64;
            resolvePreview.innerHTML =
                '<img src="' + base64 + '" alt="preview" />' +
                '<button type="button" class="akimat-resolve-preview-remove" aria-label="Удалить">&times;</button>';
            resolvePreview.classList.remove("hidden");
            resolvePreview.querySelector(".akimat-resolve-preview-remove")
                .addEventListener("click", function () {
                    resolvePhotoBase64 = null;
                    resolvePhotoIn.value = "";
                    resolvePreview.innerHTML = "";
                    resolvePreview.classList.add("hidden");
                });
        }).catch(function () {
            resolveErrEl.textContent = "Не удалось обработать фото";
        });
    });

    document.getElementById("akimat-resolve-close").addEventListener("click", function () {
        resolveOverlay.classList.add("hidden");
    });
    document.getElementById("akimat-resolve-cancel").addEventListener("click", function () {
        resolveOverlay.classList.add("hidden");
    });
    resolveOverlay.addEventListener("click", function (e) {
        if (e.target === resolveOverlay) resolveOverlay.classList.add("hidden");
    });

    document.getElementById("akimat-resolve-submit").addEventListener("click", function () {
        if (!resolvePhotoBase64) {
            resolveErrEl.textContent = t("akimat_resolve_photo_required");
            return;
        }
        var s = mapSuggestions.find(function (x) { return x.id === currentAppId; });
        if (!s) return;
        s.status = "resolved";
        s.resolvedAt = new Date().toISOString();
        s.resolvePhoto = resolvePhotoBase64;
        saveSuggestion(s);
        resolveOverlay.classList.add("hidden");
        _resetResolveModal();
    });

    // ── Wire up data listener ──
    onSuggestionsChanged(renderPanel);

    // Initial render (in case data is already loaded via localStorage fallback)
    renderPanel();
})();
