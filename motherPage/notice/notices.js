// Renders the notice list from teaClubNotices (notices-data.js). One script,
// two contexts:
//   - notice/index.html: fills #noticeList with the full list (pinned first).
//   - the main hub page: fills #noticeCarouselTrack with a "주요 공지" card
//     row of the important (pinned) notices, matching the Events / 소모임
//     card rows.
// The host element carries data-notice-prefix (how many folders below
// motherPage/ it sits: "" on the main page, "../" on the notice page).
(function () {
    "use strict";

    function formatDateKo(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
        if (!m) return String(iso || "");
        return I18N.formatDate(Number(m[1]), Number(m[2]), Number(m[3]));
    }

    // pinned first; otherwise keep the authored array order (Array.sort is
    // stable in every browser we target)
    function pinnedFirst(notices) {
        return notices.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    }

    // same "pinned first" ordering, but the rest are sorted newest-by-date
    // instead of just kept in authored order — used for the home page's
    // preview row, where "recent" needs to mean something real once
    // admin-created notices (whose date isn't tied to array position the
    // way a hand-curated array is) get merged in
    function pinnedFirstThenRecent(notices) {
        return notices.slice().sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            if (a.pinned) return 0; // keep authored order among pinned notices
            return (b.date || "").localeCompare(a.date || "");
        });
    }

    const ARROW_SVG =
        '<svg class="notice_item_arrow" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    // full grid on notice/index.html — renders every notice as a card,
    // same DOM as the home carousel via renderCards but laid out in a
    // wrapping grid instead of a horizontal scroll track.
    function renderGrid(gridEl, notices, prefix) {
        gridEl.innerHTML = "";
        pinnedFirst(notices).forEach((n) => {
            const card = el("a", "carousel_card notice_card");
            card.href = prefix + n.path;
            const body = el("div", "notice_card_body");
            if (n.pinned) body.appendChild(el("span", "notice_card_badge", I18N.t("common.pinned")));
            body.appendChild(el("h4", "notice_card_title", I18N.pick(n, "title")));
            const excerpt = I18N.pick(n, "excerpt");
            if (excerpt) body.appendChild(el("p", "notice_card_excerpt", excerpt));
            body.appendChild(el("span", "notice_card_date", formatDateKo(n.date)));
            card.appendChild(body);
            gridEl.appendChild(card);
        });
    }

    // card row on the main hub page — pinned notices first, then the most
    // recent of the rest, up to 8 total (shown as 2 rows of 4 — see
    // #noticeCarouselTrack in carousel.css, the only carousel_track on the
    // site that isn't a single scrolling row)
    function renderCards(trackEl, notices, prefix) {
        trackEl.innerHTML = "";
        const picked = pinnedFirstThenRecent(notices).slice(0, 8);
        picked.forEach((n) => {
            const card = el("a", "carousel_card notice_card");
            card.href = prefix + n.path;
            // pins the card into the grid's top or bottom row (see
            // #noticeCarouselTrack in carousel.css) — pinned notices always
            // on top, everything else on the bottom, each row packing its
            // own columns left-to-right independently of the other row
            card.style.gridRow = n.pinned ? "1" : "2";
            const body = el("div", "notice_card_body");
            if (n.pinned) body.appendChild(el("span", "notice_card_badge", I18N.t("common.pinned")));
            body.appendChild(el("h4", "notice_card_title", I18N.pick(n, "title")));
            // optional preview line; cards without an excerpt just
            // show title + date, and the CSS clamps long ones to 3 lines
            const excerpt = I18N.pick(n, "excerpt");
            if (excerpt) body.appendChild(el("p", "notice_card_excerpt", excerpt));
            body.appendChild(el("span", "notice_card_date", formatDateKo(n.date)));
            card.appendChild(body);
            trackEl.appendChild(card);
        });
    }

    function wireCarouselNav(trackEl, prevBtn, nextBtn) {
        function scrollByCard(direction) {
            const card = trackEl.querySelector(".carousel_card");
            const step = card ? card.getBoundingClientRect().width + 20 : trackEl.clientWidth;
            trackEl.scrollBy({ left: direction * step, behavior: "smooth" });
        }
        prevBtn && prevBtn.addEventListener("click", () => scrollByCard(-1));
        nextBtn && nextBtn.addEventListener("click", () => scrollByCard(1));
    }

    // admin-authored rows from the `content` backend (content-api.js) map
    // onto the exact same shape as a teaClubNotices entry — `path` points
    // at the generic view.html?id=… page instead of a hand-authored file,
    // relative to motherPage/ same as every other path in this array — so
    // renderGrid/renderCards above don't need to know the two sources apart.
    function mapDynamicNotice(n) {
        return {
            title: n.title,
            titleEn: n.titleEn,
            date: n.date,
            excerpt: n.excerpt,
            excerptEn: n.excerptEn,
            pinned: !!n.pinned,
            path: "notice/view.html?id=" + encodeURIComponent(n.id),
        };
    }

    function init() {
        if (typeof teaClubNotices === "undefined") return;

        const listEl = document.getElementById("noticeList");
        const trackEl = document.getElementById("noticeCarouselTrack");
        const section = document.getElementById("noticeCarousel");

        // static (hand-authored) + dynamic (admin-created) notices, merged
        // once fetched; starts as just the static ones so the page isn't
        // empty while the network call is in flight
        let allNotices = teaClubNotices;

        // only the rendering, so a language change can re-run it without
        // re-attaching the carousel nav listeners below
        function renderAll() {
            if (listEl) {
                renderGrid(listEl, allNotices, listEl.dataset.noticePrefix || "");
            }
            if (trackEl) {
                const prefix = (section && section.dataset.noticePrefix) || trackEl.dataset.noticePrefix || "";
                renderCards(trackEl, allNotices, prefix);
            }
        }

        renderAll();

        if (trackEl) {
            wireCarouselNav(trackEl, document.getElementById("noticeCarouselPrev"), document.getElementById("noticeCarouselNext"));
        }

        window.addEventListener("i18n:changed", renderAll);

        // fetch admin-created notices and re-render once they're in —
        // silently no-ops if content-api.js isn't loaded on this page or
        // the backend is unreachable, since the static list already rendered
        if (typeof ContentAPI !== "undefined") {
            ContentAPI.listNotices().then((res) => {
                if (!res.ok || !Array.isArray(res.notices) || res.notices.length === 0) return;
                allNotices = teaClubNotices.concat(res.notices.map(mapDynamicNotice));
                renderAll();
            }).catch(() => {});
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
