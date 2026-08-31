// Renders the upcoming-events carousel — used both on the Events page and
// embedded on the main hub page — using the `teaClubEvents` data from
// events-data.js. Shows every event that hasn't happened yet (soonest
// first). A status filter (전체/모집중/모집예정/마감) narrows which cards
// are shown.
//
// `event.path`/`event.thumbnail` are relative to motherPage/ (see
// events-data.js), so the host page must say how many folders below
// motherPage/ it sits via `data-path-prefix` on the carousel section
// (e.g. "../" one level down, "" at motherPage/ itself). Defaults to
// "../" to match the Events page, where the carousel first shipped.
(function () {
    "use strict";

    // "D-3", "D-DAY", or null for past events
    function dDayLabel(dateString) {
        if (!dateString) return null;
        const parts = dateString.split("-").map(Number);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return null;
        if (diffDays === 0) return "D-DAY";
        return `D-${diffDays}`;
    }

    // bilingual date (+ weekday, + range if endDate is set) for the card's
    // date line — events-data.js's own formatEventDateRangeKo is Korean-
    // only (shared with the hand-authored event subpages, which stay
    // Korean-only), so this uses I18N's own date formatter instead, same
    // approach as events/view.html's formatEventDateTime.
    function formatEventDate(event) {
        const parseYmd = (s) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
            return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
        };
        const start = parseYmd(event.date);
        if (!start) return event.date || "";
        let str = I18N.formatDateWithWeekday(start[0], start[1], start[2]);
        if (event.endDate && event.endDate !== event.date) {
            const end = parseYmd(event.endDate);
            if (end) str += " ~ " + I18N.formatDateWithWeekday(end[0], end[1], end[2]);
        }
        return str;
    }

    // 예정/종료 → Upcoming/Closed in English mode — eventStatuses itself
    // (events-data.js) stays Korean-only since hand-authored event
    // subpages read it directly too; this carousel card is the one place
    // that's otherwise fully bilingual, so it looks up the i18n version
    // instead of eventStatuses[key].label directly.
    function statusLabel(effectiveStatus, fallback) {
        if (typeof I18N === "undefined") return fallback;
        const key = effectiveStatus === "upcoming" ? "events.statusUpcoming" : "events.statusClosed";
        return I18N.t(key) || fallback;
    }

    function renderCard(event, pathPrefix) {
        const card = document.createElement("a");
        card.className = "carousel_card";
        card.href = `${pathPrefix}${event.path}`;

        const thumb = document.createElement("div");
        thumb.className = "carousel_thumb";
        if (event.thumbnail) {
            thumb.style.backgroundImage = `url(${pathPrefix}${event.thumbnail})`;
        } else {
            thumb.classList.add("is-empty");
        }

        const effectiveStatus = typeof effectiveEventStatus === "function" ? effectiveEventStatus(event) : event.status;
        const status = typeof eventStatuses !== "undefined" ? eventStatuses[effectiveStatus] : null;
        if (status) {
            const statusEl = document.createElement("span");
            statusEl.className = `carousel_status event_status_${effectiveStatus}`;
            statusEl.textContent = statusLabel(effectiveStatus, status.label);
            thumb.appendChild(statusEl);
        }
        const dday = dDayLabel(event.date);
        if (dday) {
            const ddayEl = document.createElement("span");
            ddayEl.className = "carousel_dday" + (dday === "D-DAY" ? " is-today" : "");
            ddayEl.textContent = dday;
            thumb.appendChild(ddayEl);
        }
        card.appendChild(thumb);

        const body = document.createElement("div");
        body.className = "carousel_body";

        const dateEl = document.createElement("span");
        dateEl.className = "carousel_date";
        dateEl.textContent = formatEventDate(event);
        body.appendChild(dateEl);

        const titleEl = document.createElement("h4");
        titleEl.className = "carousel_name";
        // uses titleEn in English mode when the admin set one (the
        // titleEn field on the event form) — static teaClubEvents entries
        // have no titleEn, so I18N.pick just falls back to the Korean
        // title there, same as it always has
        titleEl.textContent = typeof I18N !== "undefined" ? I18N.pick(event, "title") : event.title;
        body.appendChild(titleEl);

        if (event.subtitle || event.subtitleEn) {
            const descEl = document.createElement("p");
            descEl.className = "carousel_desc";
            descEl.textContent = typeof I18N !== "undefined" ? I18N.pick(event, "subtitle") : event.subtitle;
            body.appendChild(descEl);
        }

        card.appendChild(body);
        return card;
    }

    // admin-authored rows from the `content` backend (content-api.js) map
    // onto the same shape as a teaClubEvents entry — `path` points at the
    // generic view.html?id=… page instead of a hand-authored folder, still
    // relative to motherPage/ same as every other path in that array — so
    // renderCard/renderTrack below don't need to know the two sources apart.
    function mapDynamicEvent(e) {
        return {
            date: e.date,
            endDate: e.endDate || undefined,
            time: e.time || undefined,
            // kept as raw title/titleEn (not pre-resolved to one string)
            // so renderCard can pick the right one at render time via
            // I18N.pick — this object is only built once per fetch, but
            // needs to stay reactive to a later language toggle
            title: e.title,
            titleEn: e.titleEn || undefined,
            subtitle: e.introTitle || undefined,
            subtitleEn: e.introTitleEn || undefined,
            path: "events/view.html?id=" + encodeURIComponent(e.id),
            thumbnail: e.heroImageUrl || undefined,
            // the shared shape's `location` is what gets displayed (see
            // events-meta.js's addRow) — map it to the venue name, not the
            // raw geocoding address, which is never shown publicly
            location: e.venueName || undefined,
            lat: e.lat != null ? e.lat : undefined,
            lng: e.lng != null ? e.lng : undefined,
            mapLink: e.mapLink || undefined,
            fee: e.fee || undefined,
            "인원": e.capacity != null ? e.capacity : undefined,
            category: e.category || "regulars",
        };
    }

    function init() {
        const section = document.getElementById("eventCarousel");
        const track = document.getElementById("carouselTrack");
        const prevBtn = document.getElementById("carouselPrev");
        const nextBtn = document.getElementById("carouselNext");
        const filterToggle = document.getElementById("filterToggle");
        const filterToggleLabel = document.getElementById("filterToggleLabel");
        const filterMenu = document.getElementById("filterMenu");

        if (!section || !track) {
            return;
        }

        const pathPrefix = section.dataset.pathPrefix !== undefined ? section.dataset.pathPrefix : "../";

        // static (hand-authored) + dynamic (admin-created) events, merged
        // once fetched; starts as just the static ones so the carousel
        // isn't empty while the network call is in flight
        let allEvents = typeof teaClubEvents !== "undefined" ? teaClubEvents : [];

        // newest date first — single pool for every filter; 전체 and 마감
        // include past events, status filters narrow within this
        function sortedDesc() {
            return allEvents.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        }

        function renderTrack(filterStatus) {
            const allEventsDesc = sortedDesc();
            track.innerHTML = "";
            const filtered = filterStatus === "all"
                ? allEventsDesc
                : allEventsDesc.filter((event) => (typeof effectiveEventStatus === "function" ? effectiveEventStatus(event) : event.status) === filterStatus);
            filtered.forEach((event) => {
                track.appendChild(renderCard(event, pathPrefix));
            });
        }

        // remembers the active filter so a re-render (once dynamic events
        // arrive) doesn't reset it back to "전체"; also hides the whole
        // section when there's nothing to show yet (e.g. the static list is
        // empty and the dynamic fetch hasn't landed), same as the original
        // early-return, but re-checked on every render instead of once.
        let activeFilter = "all";
        function renderTrackKeepingFilter() {
            section.style.display = allEvents.length === 0 ? "none" : "";
            renderTrack(activeFilter);
        }

        renderTrackKeepingFilter();

        // fetch admin-created events and re-render once they're in —
        // silently no-ops if content-api.js isn't loaded on this page or
        // the backend is unreachable, since the static list already rendered
        if (typeof ContentAPI !== "undefined") {
            ContentAPI.listEvents().then((res) => {
                if (!res.ok || !Array.isArray(res.events) || res.events.length === 0) return;
                allEvents = allEvents.concat(res.events.map(mapDynamicEvent));
                renderTrackKeepingFilter();
            }).catch(() => {});
        }

        // filter dropdown: "전체" plus every status that eventStatuses defines
        if (filterToggle && filterToggleLabel && filterMenu && typeof eventStatuses !== "undefined") {
            const options = [{ key: "all", label: I18N.t("common.all") }].concat(
                Object.keys(eventStatuses).map((key) => ({ key, label: eventStatuses[key].label }))
            );

            options.forEach((option) => {
                const item = document.createElement("li");
                item.className = "filter_option";
                item.textContent = option.label;
                item.dataset.status = option.key;
                item.setAttribute("role", "option");
                item.setAttribute("aria-selected", option.key === "all" ? "true" : "false");
                if (option.key === "all") {
                    item.classList.add("is-selected");
                }
                item.addEventListener("click", () => {
                    filterMenu.querySelectorAll(".filter_option").forEach((el) => {
                        el.classList.remove("is-selected");
                        el.setAttribute("aria-selected", "false");
                    });
                    item.classList.add("is-selected");
                    item.setAttribute("aria-selected", "true");
                    filterToggleLabel.textContent = option.label;
                    activeFilter = option.key;
                    renderTrack(activeFilter);
                    closeMenu();
                });
                filterMenu.appendChild(item);
            });

            function openMenu() {
                filterMenu.hidden = false;
                filterToggle.setAttribute("aria-expanded", "true");
            }
            function closeMenu() {
                filterMenu.hidden = true;
                filterToggle.setAttribute("aria-expanded", "false");
            }

            filterToggle.addEventListener("click", (e) => {
                e.stopPropagation();
                if (filterMenu.hidden) {
                    openMenu();
                } else {
                    closeMenu();
                }
            });

            document.addEventListener("click", (e) => {
                if (!filterMenu.hidden && !filterMenu.contains(e.target) && e.target !== filterToggle) {
                    closeMenu();
                }
            });

            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    closeMenu();
                }
            });
        }

        function scrollByCard(direction) {
            const card = track.querySelector(".carousel_card");
            const step = card ? card.getBoundingClientRect().width + 20 : track.clientWidth;
            track.scrollBy({ left: direction * step, behavior: "smooth" });
        }

        prevBtn?.addEventListener("click", () => scrollByCard(-1));
        nextBtn?.addEventListener("click", () => scrollByCard(1));

        // re-render on language toggle so the status badge switches too —
        // everything else here was Korean-only either way, so this wasn't
        // needed until now
        window.addEventListener("i18n:changed", renderTrackKeepingFilter);
    }

    // exposed so calendar.js can merge admin-created events into its own
    // month grid the same way this carousel does, without a second copy of
    // this mapping
    window.EventsCarousel = { mapDynamicEvent };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
