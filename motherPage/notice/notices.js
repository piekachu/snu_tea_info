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

    const ARROW_SVG =
        '<svg class="notice_item_arrow" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    // full title/date rows on notice/index.html (markup matches notice.css)
    function renderList(listEl, notices, prefix) {
        listEl.innerHTML = "";
        pinnedFirst(notices).forEach((n) => {
            const li = el("li", "notice_item" + (n.pinned ? " is-pinned" : ""));
            const link = el("a", "notice_item_link");
            link.href = prefix + n.path;
            if (n.pinned) link.appendChild(el("span", "notice_item_badge", I18N.t("common.pinned")));
            link.appendChild(el("span", "notice_item_title", I18N.pick(n, "title")));
            link.appendChild(el("span", "notice_item_date", formatDateKo(n.date)));
            const arrowHolder = document.createElement("span");
            arrowHolder.innerHTML = ARROW_SVG;
            link.appendChild(arrowHolder.firstChild);
            li.appendChild(link);
            listEl.appendChild(li);
        });
    }

    // card row on the main hub page — previews the important (pinned) notices
    function renderCards(trackEl, notices, prefix) {
        trackEl.innerHTML = "";
        let picked = notices.filter((n) => n.pinned);
        // if nothing is pinned, fall back to the most recent few so the row
        // isn't empty
        if (picked.length === 0) picked = pinnedFirst(notices).slice(0, 4);
        picked.forEach((n) => {
            const card = el("a", "carousel_card notice_card");
            card.href = prefix + n.path;
            const body = el("div", "notice_card_body");
            if (n.pinned) body.appendChild(el("span", "notice_card_badge", I18N.t("common.pinned")));
            body.appendChild(el("h4", "notice_card_title", I18N.pick(n, "title")));
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

    function init() {
        if (typeof teaClubNotices === "undefined") return;

        const listEl = document.getElementById("noticeList");
        const trackEl = document.getElementById("noticeCarouselTrack");
        const section = document.getElementById("noticeCarousel");

        // only the rendering, so a language change can re-run it without
        // re-attaching the carousel nav listeners below
        function renderAll() {
            if (listEl) {
                renderList(listEl, teaClubNotices, listEl.dataset.noticePrefix || "");
            }
            if (trackEl) {
                const prefix = (section && section.dataset.noticePrefix) || trackEl.dataset.noticePrefix || "";
                renderCards(trackEl, teaClubNotices, prefix);
            }
        }

        renderAll();

        if (trackEl) {
            wireCarouselNav(trackEl, document.getElementById("noticeCarouselPrev"), document.getElementById("noticeCarouselNext"));
        }

        window.addEventListener("i18n:changed", renderAll);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
