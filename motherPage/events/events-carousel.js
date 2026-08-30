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
            statusEl.textContent = status.label;
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
        dateEl.textContent = formatEventDateRangeKo(event.date, event.endDate);
        body.appendChild(dateEl);

        const titleEl = document.createElement("h4");
        titleEl.className = "carousel_name";
        titleEl.textContent = event.title;
        body.appendChild(titleEl);

        if (event.subtitle) {
            const descEl = document.createElement("p");
            descEl.className = "carousel_desc";
            descEl.textContent = event.subtitle;
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
            title: e.title,
            subtitle: e.introTitle || undefined,
            path: "events/view.html?id=" + encodeURIComponent(e.id),
            thumbnail: e.heroImageUrl || undefined,
            location: e.location || undefined,
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
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
