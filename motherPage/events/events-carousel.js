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

    // fallback thumbnails for events without a hero image — filenames with
    // spaces are URL-encoded so the background-image URL stays valid
    const THUMB_POOL = [
        "0001.png","0002.png","0101.png","0102.png","0103.png",
        "0201.png","0202.png","0203.png","0301.png","0302.png",
        "0401.png","0402.png","0403.png","0501.png","0502.png","0503.png",
        "1-b98aa004.jpg","9901.png","9902.png","9903.png","9904.png",
        "IMG_7989.jpeg","IMG_7990.jpeg","IMG_7991.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-33-02 025.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-33-02 026.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-33-02 027.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-33-02 028.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-33-02 029.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-33-02 030.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-40-43 001.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-40-44 002.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-40-44 003.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-40-44 004.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-10 001.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-10 002.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-10 003.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-20 001.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-20 002.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-20 003.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-20 004.jpeg",
        "KakaoTalk_Photo_2026-06-20-14-41-20 005.jpeg",
        "Picture1.png","img_02.jpg","teainside_04.webp",
    ].map((f) => `tea_image_pool/${encodeURIComponent(f)}`);

    // deterministic pick — same event always gets the same image
    function poolThumbnail(event) {
        const seed = event.path || event.title || "";
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
        return THUMB_POOL[hash % THUMB_POOL.length];
    }

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
        const thumbSrc = event.thumbnail || poolThumbnail(event);
        thumb.style.backgroundImage = `url(${pathPrefix}${thumbSrc})`;

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

        // all events, newest date first — single pool for every filter;
        // 전체 and 마감 include past events, status filters narrow within this
        const allEventsDesc = (typeof teaClubEvents !== "undefined" ? teaClubEvents : [])
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

        if (allEventsDesc.length === 0) {
            section.style.display = "none";
            return;
        }

        function renderTrack(filterStatus) {
            track.innerHTML = "";
            const filtered = filterStatus === "all"
                ? allEventsDesc
                : allEventsDesc.filter((event) => (typeof effectiveEventStatus === "function" ? effectiveEventStatus(event) : event.status) === filterStatus);
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
