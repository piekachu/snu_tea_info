/* ---------------------------------------------------------------------------
 * join-manual.js
 * Lightbox walkthrough for the 소모임 신청 page.
 *
 * A floating "?" FAB opens a modal that mirrors the /notice/meetup-signup.html
 * manual but in a click-to-advance carousel layout — one screenshot fills the
 * frame, tapping the image or the right arrow advances to the next step.
 * Two tabs at the top switch between the create (Part 1, 9 steps) and join
 * (Part 2, 5 steps) walkthroughs, matching the full-page manual.
 *
 * Slide prose is condensed — this is a quick reference, not the full manual.
 * The "전체 안내 보기 →" link at the bottom takes readers to the fleshed-out
 * meetup-signup.html page (with the yellow ! callouts and full paragraphs).
 * ------------------------------------------------------------------------- */
(function () {
    "use strict";

    // Screenshots live under the notice manual; we hot-link them so there is
    // exactly one place to update if a UI change requires new captures.
    const IMG_BASE = "../notice/images/meetup/";

    const SLIDES = {
        create: [
            {
                img: "01-calendar-view.png",
                title: "소모임 신청 페이지를 열어주세요.",
                body: "이번 달 캘린더가 뜹니다. 이미 열린 소모임은 초록색 칩으로 표시되고, 좌우 화살표로 다른 달을 살펴볼 수 있어요.",
            },
            {
                img: "02-date-selection.png",
                title: "소모임을 열고 싶은 날짜를 골라주세요.",
                body: "빈 날짜를 클릭하면 아래 패널이 열리고 오른쪽에 “+ 새 소모임 만들기” 버튼이 초록색으로 활성화됩니다. 소모임은 내일 이후 날짜부터 만들 수 있어요.",
            },
            {
                img: "03-fill-out-info.png",
                title: "소모임 정보를 입력해주세요.",
                body: "이름·시간·정원·장소·주최자·비밀번호·소개를 채워주세요. 편집 비밀번호는 나중에 수정/삭제나 참가자 연락처 확인에 꼭 필요하니 안전한 곳에 적어두세요.",
            },
            {
                img: "04-pending-approval.png",
                title: "'관리자 승인 대기 중' 상태가 돼요.",
                body: "등록된 소모임은 즉시 캘린더에 뜨지만, 관리자가 승인하기 전까지는 주최자 외에는 신청할 수 없어요.",
            },
            {
                img: "05-kakaotalk-request.png",
                title: "단체 카카오톡방에서 승인을 요청해주세요.",
                body: "상단의 공유 버튼(↑)을 누르면 소모임 정보와 신청 링크가 한 번에 정리된 텍스트가 복사돼요. 그대로 잡담방에 붙여넣어주세요.",
            },
            {
                img: "06-meetup-approved.png",
                title: "관리자가 승인하면 신청이 열려요.",
                body: "승인 대기 배지가 사라지고, 부원들이 링크를 통해 바로 신청할 수 있어요.",
            },
            {
                img: "07-people-signed-up.png",
                title: "신청이 들어오면 참가자 명단이 채워져요.",
                body: "누군가 신청하면 초록 칩으로 이름이 추가돼요. 다른 참가자가 있으면 소모임을 삭제할 수 없으니, 취소해야 한다면 먼저 안내해주세요.",
            },
            {
                img: "08-participant-contacts.png",
                title: "주최자는 참가자 연락처를 확인할 수 있어요.",
                body: "‘참가자 연락처 보기’를 누르면 실명과 연락처가 표시돼요. 다른 기기에서는 편집 비밀번호를 한 번 입력해야 볼 수 있어요.",
            },
            {
                img: "09-meetup-review.png",
                title: "소모임이 끝난 뒤에는 짧은 후기를 남겨주세요.",
                body: "단체 카톡방에 날짜·이름·인원과 함께 마셨던 차나 인상적인 순간을 몇 줄 남겨주세요. 사진도 함께 공유해주시면 좋아요!",
            },
        ],
        join: [
            {
                img: "join-01-calendar-view.png",
                title: "소모임 신청 페이지에서 캘린더를 살펴봐주세요.",
                body: "열려 있는 소모임은 초록색 칩으로 날짜 아래에 이름이 표시돼요.",
            },
            {
                img: "join-02-date-selection.png",
                title: "관심 있는 소모임이 열린 날짜를 클릭해주세요.",
                body: "화면 아래 패널에 그 날의 소모임 카드가 뜹니다. 오른쪽에는 현재 인원/정원이 초록 칩으로 붙어요.",
            },
            {
                img: "join-03-open-event.png",
                title: "소모임 카드를 눌러 상세 창을 열어주세요.",
                body: "일시·장소·주최자·정원·소개와 참가자 목록을 확인할 수 있어요. 신청은 소모임 전날까지만 받을 수 있어요.",
            },
            {
                img: "join-04-signing-form.png",
                title: "신청 폼을 채워주세요.",
                body: "이름(공개), 실명(관리자 전용), 연락처(주최자 전용, 선택), 취소 비밀번호를 입력합니다. 취소 비밀번호는 다른 기기에서 취소할 때 반드시 필요해요.",
            },
            {
                img: "join-05-completion.png",
                title: "'신청하기'를 누르면 완료!",
                body: "인원 칩이 늘어나고 참가자 목록에 이름이 추가돼요. 같은 기기에서는 신청 취소하기 링크로 바로 취소할 수 있고, 다른 기기에서 신청했다면 하단의 ‘비밀번호로 취소하기’를 눌러주세요. 취소는 소모임 2일 전까지만 가능해요.",
            },
        ],
    };

    // ---- state -----------------------------------------------------------
    let activeTab = "create";
    let idx = 0;

    // ---- DOM refs (filled once on init) ---------------------------------
    let overlay, tabsEl, imgEl, titleEl, bodyEl, dotsEl, progressEl,
        prevBtn, nextBtn, closeBtn;

    function currentSlides() { return SLIDES[activeTab]; }

    function render() {
        const slides = currentSlides();
        const slide = slides[idx];
        if (!slide) return;

        imgEl.src = IMG_BASE + slide.img;
        imgEl.alt = slide.title;
        titleEl.textContent = slide.title;
        bodyEl.textContent = slide.body;
        progressEl.textContent = (idx + 1) + " / " + slides.length;

        // rebuild dots — cheap, only 5–9 of them
        dotsEl.innerHTML = "";
        for (let i = 0; i < slides.length; i++) {
            const d = document.createElement("button");
            d.type = "button";
            d.className = "join_help_dot" + (i === idx ? " is-active" : "");
            d.setAttribute("aria-label", "슬라이드 " + (i + 1));
            d.addEventListener("click", function () { goto(i); });
            dotsEl.appendChild(d);
        }

        // disable arrows at the ends instead of wrapping — less disorienting
        prevBtn.disabled = idx === 0;
        nextBtn.disabled = idx === slides.length - 1;
    }

    function goto(i) {
        const slides = currentSlides();
        if (i < 0 || i >= slides.length) return;
        idx = i;
        render();
    }
    function next() { goto(idx + 1); }
    function prev() { goto(idx - 1); }

    function switchTab(name) {
        if (activeTab === name) return;
        activeTab = name;
        idx = 0;
        tabsEl.querySelectorAll(".join_help_tab").forEach(function (b) {
            const active = b.dataset.tab === name;
            b.classList.toggle("is-active", active);
            b.setAttribute("aria-selected", active ? "true" : "false");
        });
        render();
    }

    function open() {
        overlay.hidden = false;
        // lock body scroll while the modal is up
        document.body.style.overflow = "hidden";
        render();
        // focus the close button for keyboard users
        setTimeout(function () { closeBtn.focus(); }, 0);
    }
    function close() {
        overlay.hidden = true;
        document.body.style.overflow = "";
    }

    function onKey(e) {
        if (overlay.hidden) return;
        if (e.key === "Escape") { close(); return; }
        if (e.key === "ArrowRight") { next(); return; }
        if (e.key === "ArrowLeft") { prev(); return; }
    }

    // ---- init -----------------------------------------------------------
    function init() {
        overlay    = document.getElementById("joinHelpOverlay");
        if (!overlay) return; // page didn't include the modal — nothing to wire

        tabsEl     = overlay.querySelector(".join_help_tabs");
        imgEl      = overlay.querySelector(".join_help_img");
        titleEl    = overlay.querySelector(".join_help_slide_title");
        bodyEl     = overlay.querySelector(".join_help_slide_body");
        dotsEl     = overlay.querySelector(".join_help_dots");
        progressEl = overlay.querySelector(".join_help_progress");
        prevBtn    = overlay.querySelector(".join_help_prev");
        nextBtn    = overlay.querySelector(".join_help_next");
        closeBtn   = overlay.querySelector(".join_help_close");

        const fab = document.getElementById("joinHelpFab");
        if (fab) fab.addEventListener("click", open);

        closeBtn.addEventListener("click", close);
        prevBtn.addEventListener("click", prev);
        nextBtn.addEventListener("click", next);
        imgEl.addEventListener("click", next);           // click image → advance
        tabsEl.addEventListener("click", function (e) {
            const btn = e.target.closest(".join_help_tab");
            if (btn) switchTab(btn.dataset.tab);
        });
        // click on the backdrop (not the panel itself) → close
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) close();
        });
        document.addEventListener("keydown", onKey);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
