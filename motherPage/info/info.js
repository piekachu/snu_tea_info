// 정보 목록을 teaClubInfo(info-data.js)에서 렌더링. 두 가지 컨텍스트:
//   - info/index.html : #infoList에 전체 목록 (고정 먼저)
//   - 메인 허브 페이지 : #infoCarouselTrack에 카드 행 (고정/최근 순)
// notices.js와 동일한 패턴을 따름.
(function () {
    "use strict";

    function formatDateKo(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
        if (!m) return String(iso || "");
        return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`;
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

    // full title/date rows on info/index.html
    function renderList(listEl, items, prefix) {
        listEl.innerHTML = "";

        if (items.length === 0) {
            const empty = el("p", "notice_item_placeholder", "등록된 정보 글이 없어요.");
            listEl.parentNode.insertBefore(empty, listEl);
            return;
        }

        pinnedFirst(items).forEach((n) => {
            const li = el("li", "notice_item" + (n.pinned ? " is-pinned" : ""));
            const link = el("a", "notice_item_link");
            link.href = prefix + n.path;
            if (n.pinned) link.appendChild(el("span", "notice_item_badge", "고정"));
            link.appendChild(el("span", "notice_item_title", n.title));
            link.appendChild(el("span", "notice_item_date", formatDateKo(n.date)));
            const arrowHolder = document.createElement("span");
            arrowHolder.innerHTML = ARROW_SVG;
            link.appendChild(arrowHolder.firstChild);
            li.appendChild(link);
            listEl.appendChild(li);
        });
    }

    // card row on the main hub page
    function renderCards(trackEl, items, prefix) {
        trackEl.innerHTML = "";

        if (items.length === 0) {
            const empty = el("p", "info_carousel_empty", "아직 등록된 정보 글이 없어요.");
            trackEl.parentNode.appendChild(empty);
            return;
        }

        let picked = items.filter((n) => n.pinned);
        if (picked.length === 0) picked = pinnedFirst(items).slice(0, 4);

        picked.forEach((n) => {
            const card = el("a", "carousel_card notice_card");
            card.href = prefix + n.path;
            const body = el("div", "notice_card_body");
            if (n.pinned) body.appendChild(el("span", "notice_card_badge", "고정"));
            body.appendChild(el("h4", "notice_card_title", n.title));
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

        // info/index.html list
        const listEl = document.getElementById("infoList");
        if (listEl) {
            renderList(listEl, teaClubInfo, listEl.dataset.infoPrefix || "");
        }

        // main hub carousel
        const trackEl = document.getElementById("infoCarouselTrack");
        if (trackEl) {
            const section = document.getElementById("infoCarousel");
            const prefix = (section && section.dataset.infoPrefix) || trackEl.dataset.infoPrefix || "";
            renderCards(trackEl, teaClubInfo, prefix);
            wireCarouselNav(
                trackEl,
                document.getElementById("infoCarouselPrev"),
                document.getElementById("infoCarouselNext")
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
