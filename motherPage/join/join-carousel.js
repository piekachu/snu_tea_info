// Renders a "다가오는 소모임" preview carousel on the main hub page
// (motherPage/index.html), in the same visual language as the curated
// Events carousel (events/events-carousel.js) — reuses its .carousel_card/
// .carousel_thumb/.carousel_status/.carousel_body classes from
// events/carousel.css rather than introducing a parallel set of styles.
//
// Read-only: no create/signup here, just a preview linking through to the
// real join page (join/index.html?event=<id> — see join.js's
// openSharedEventIfAny, which opens straight to that event on load).
//
// Pulls from the same source join.js does: the deployed Apps Script Web
// App named in join-config.js, or — if that's unset — the same
// "joinDemoData_v1" localStorage key join.js's demo mode reads/writes, so
// locally-created test events show up in this preview too.
(function () {
    "use strict";

    const API_URL = (window.JOIN_APPS_SCRIPT_URL || "").trim();
    const DEMO_MODE = !API_URL;
    const DEMO_KEY = "joinDemoData_v1";

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    function formatDateShortKo(dateKey) {
        const parts = dateKey.split("-").map(Number);
        const wd = ["일", "월", "화", "수", "목", "금", "토"][new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
        return `${parts[1]}월 ${parts[2]}일 (${wd})`;
    }

    function formatTime(time) {
        if (!time) return "";
        const [h, m] = time.split(":").map(Number);
        const period = h < 12 ? "오전" : "오후";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${period} ${h12}:${pad2(m)}`;
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function fetchEvents() {
        if (DEMO_MODE) {
            try {
                const raw = JSON.parse(localStorage.getItem(DEMO_KEY));
                return { events: (raw && raw.events) || [], signups: (raw && raw.signups) || [] };
            } catch (err) {
                return { events: [], signups: [] };
            }
        }
        // Apps Script Web Apps occasionally answer a fresh request with a
        // transient error (a bare 404, or an HTML error page where JSON was
        // expected) that clears up immediately on retry — see the identical
        // fetchJson in join.js, where this was first hit.
        let lastErr;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(`${API_URL}?action=list`, { method: "GET", cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                return { events: data.events || [], signups: data.signups || [] };
            } catch (err) {
                lastErr = err;
                if (attempt === 0) await sleep(700);
            }
        }
        throw lastErr;
    }

    function isFull(event, signupCount) {
        if (event.capacity === "" || event.capacity == null) return false;
        return signupCount >= Number(event.capacity);
    }

    function capacityLabel(event, signupCount) {
        return event.capacity === "" || event.capacity == null ? `신청 ${signupCount}명` : `${signupCount}/${event.capacity}명`;
    }

    function renderCard(event, signupCount) {
        const card = document.createElement("a");
        card.className = "carousel_card";
        card.href = `join/index.html?event=${encodeURIComponent(event.id)}`;

        const thumb = document.createElement("div");
        thumb.className = "carousel_thumb is-empty";
        // no thumbnail image for a user-created meetup — reuse the same
        // recruiting/closed badge look the curated events use instead
        const full = isFull(event, signupCount);
        const badge = document.createElement("span");
        badge.className = `carousel_status ${full ? "event_status_closed" : "event_status_recruiting"}`;
        badge.textContent = full ? "마감" : capacityLabel(event, signupCount);
        thumb.appendChild(badge);
        card.appendChild(thumb);

        const body = document.createElement("div");
        body.className = "carousel_body";

        const dateEl = document.createElement("span");
        dateEl.className = "carousel_date";
        dateEl.textContent = [formatDateShortKo(event.date), formatTime(event.time)].filter(Boolean).join(" · ");
        body.appendChild(dateEl);

        const titleEl = document.createElement("h4");
        titleEl.className = "carousel_name";
        titleEl.textContent = event.title;
        body.appendChild(titleEl);

        const descParts = [event.location, event.host ? `주최: ${event.host}` : ""].filter(Boolean);
        if (descParts.length > 0) {
            const descEl = document.createElement("p");
            descEl.className = "carousel_desc";
            descEl.textContent = descParts.join(" · ");
            body.appendChild(descEl);
        }

        card.appendChild(body);
        return card;
    }

    // shown in place of the card row when there's nothing upcoming yet —
    // an invitation to go make the first one, rather than just an empty
    // carousel or (as before) hiding the section outright
    function renderAddCard() {
        const card = document.createElement("a");
        card.className = "carousel_card carousel_card_add";
        card.href = "join/index.html";

        const icon = document.createElement("span");
        icon.className = "carousel_add_icon";
        icon.textContent = "+";
        icon.setAttribute("aria-hidden", "true");
        card.appendChild(icon);

        const label = document.createElement("p");
        label.className = "carousel_add_label";
        label.textContent = "새 소모임 만들기";
        card.appendChild(label);

        return card;
    }

    async function init() {
        const section = document.getElementById("joinCarousel");
        const track = document.getElementById("joinCarouselTrack");
        const prevBtn = document.getElementById("joinCarouselPrev");
        const nextBtn = document.getElementById("joinCarouselNext");
        const controls = section ? section.querySelector(".carousel_controls") : null;
        if (!section || !track) return;

        let events;
        let signups;
        try {
            const data = await fetchEvents();
            events = data.events;
            signups = data.signups;
        } catch (err) {
            // a real fetch failure, not "zero events" — we don't actually
            // know how many there are, so hide rather than show a
            // misleadingly-empty "add" prompt
            console.error("[join-carousel]", err);
            section.style.display = "none";
            return;
        }

        const today = todayKey();
        const upcoming = events
            .filter((event) => event.date >= today)
            .slice()
            .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

        track.innerHTML = "";

        if (upcoming.length === 0) {
            if (controls) controls.style.display = "none";
            track.appendChild(renderAddCard());
            return;
        }

        if (controls) controls.style.display = "";
        upcoming.forEach((event) => {
            const count = signups.filter((s) => s.eventId === event.id).length;
            track.appendChild(renderCard(event, count));
        });

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
