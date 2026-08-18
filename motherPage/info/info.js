// 정보 목록을 teaClubInfo(info-data.js)에서 렌더링. 두 가지 컨텍스트:
//   - info/index.html : #infoList에 전체 목록 (고정 먼저)
//   - 메인 허브 페이지 : #infoCarouselTrack에 카드 행 (고정/최근 순)
// notices.js와 동일한 패턴을 따름.
(function () {
    "use strict";

    function formatDateKo(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
        if (!m) return String(iso || "");
        return I18N.formatDate(Number(m[1]), Number(m[2]), Number(m[3]));
    }

    function pinnedFirst(items) {
        return items.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
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

    // full grid on info/index.html — renders every item as a card
    // (same DOM as the home carousel via renderCards, just laid out
    // in a wrapping grid instead of a horizontal scroll track)
    function renderGrid(gridEl, items, prefix) {
        gridEl.innerHTML = "";
        // drop a placeholder left behind by a previous render
        const stale = gridEl.parentNode.querySelector(".notice_item_placeholder");
        if (stale) stale.remove();

        if (items.length === 0) {
            const empty = el("p", "notice_item_placeholder", I18N.t("info.empty"));
            gridEl.parentNode.insertBefore(empty, gridEl);
            return;
        }

        pinnedFirst(items).forEach((n) => {
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

    // card row on the main hub page
    function renderCards(trackEl, items, prefix) {
        trackEl.innerHTML = "";
        const staleCard = trackEl.parentNode.querySelector(".info_carousel_empty");
        if (staleCard) staleCard.remove();

        if (items.length === 0) {
            const empty = el("p", "info_carousel_empty", I18N.t("info.emptyCarousel"));
            trackEl.parentNode.appendChild(empty);
            return;
        }

        let picked = items.filter((n) => n.pinned);
        if (picked.length === 0) picked = pinnedFirst(items).slice(0, 4);

        picked.forEach((n) => {
            const card = el("a", "carousel_card notice_card");
            card.href = prefix + n.path;
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

    function init() {
        if (typeof teaClubInfo === "undefined") return;

        const listEl = document.getElementById("infoList");        // info/index.html list
        const trackEl = document.getElementById("infoCarouselTrack"); // main hub carousel
        const section = document.getElementById("infoCarousel");

        // only the rendering, so it can be re-run on a language change without
        // re-attaching the carousel nav listeners below
        function renderAll() {
            if (listEl) {
                renderGrid(listEl, teaClubInfo, listEl.dataset.infoPrefix || "");
            }
            if (trackEl) {
                const prefix = (section && section.dataset.infoPrefix) || trackEl.dataset.infoPrefix || "";
                renderCards(trackEl, teaClubInfo, prefix);
            }
        }

        renderAll();

        if (trackEl) {
            wireCarouselNav(
                trackEl,
                document.getElementById("infoCarouselPrev"),
                document.getElementById("infoCarouselNext")
            );
        }

        window.addEventListener("i18n:changed", renderAll);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
