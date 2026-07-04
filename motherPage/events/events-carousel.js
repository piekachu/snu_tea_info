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

        const allEvents = typeof teaClubEvents !== "undefined" ? teaClubEvents : [];
        const upcoming = allEvents
            .filter((event) => (typeof isPastEvent === "function" ? !isPastEvent(event) : true))
            .slice()
            .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

        if (upcoming.length === 0) {
            section.style.display = "none";
            return;
        }

        function renderTrack(filterStatus) {
            track.innerHTML = "";
            const filtered = filterStatus === "all"
                ? upcoming
                : upcoming.filter((event) => (typeof effectiveEventStatus === "function" ? effectiveEventStatus(event) : event.status) === filterStatus);
            filtered.forEach((event) => {
                track.appendChild(renderCard(event, pathPrefix));
            });
        }

        renderTrack("all");

        // filter dropdown: "전체" plus every status that eventStatuses defines
        if (filterToggle && filterToggleLabel && filterMenu && typeof eventStatuses !== "undefined") {
            const options = [{ key: "all", label: "전체" }].concat(
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
                    renderTrack(option.key);
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
