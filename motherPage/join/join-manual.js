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
 * The "See the full guide →" link at the bottom takes readers to the
 * fleshed-out meetup-signup.html page (with the yellow ! callouts and full
 * paragraphs).
 *
 * i18n: every slide's title/body/notes is a {ko, en} pair, kept local to
 * this file rather than routed through the global i18n.js dictionary —
 * this is a condensed rewrite of the full manual's copy (not verbatim reuse
 * of it), so co-locating each slide's Korean and English keeps them easy to
 * compare and edit together. The static modal chrome (tabs, close/prev/next,
 * "See the full guide" link) IS wired through i18n.js as usual — see the
 * data-i18n attributes on the modal markup in join/index.html.
 * ------------------------------------------------------------------------- */
(function () {
    "use strict";

    // Screenshots live under the notice manual; we hot-link them so there is
    // exactly one place to update if a UI change requires new captures.
    const IMG_BASE = "../notice/images/meetup/";

    // pick the right language for a {ko, en} pair, falling back to ko if an
    // en value is missing — same rule I18N.t() itself follows
    function pick(pair) {
        if (!pair) return "";
        return (window.I18N && window.I18N.lang === "en" && pair.en) ? pair.en : pair.ko;
    }

    // Each slide can carry a `notes` array — rendered as yellow "!" callouts
    // below the body, matching the .man_note style on the full manual page.
    const SLIDES = {
        create: [
            {
                img: "01-calendar-view.png",
                title: { ko: "소모임 신청 페이지를 열어주세요.", en: "Open the meetup sign-up page." },
                body: { ko: "이번 달 캘린더가 뜹니다. 이미 열린 소모임은 초록색 칩으로 표시되고, 좌우 화살표로 다른 달을 살펴볼 수 있어요.",
                        en: "This month's calendar shows up. Open meetups appear as green chips, and the side arrows let you browse other months." },
            },
            {
                img: "02-date-selection.png",
                title: { ko: "소모임을 열고 싶은 날짜를 골라주세요.", en: "Pick the date you'd like to open a meetup on." },
                body: { ko: "빈 날짜를 클릭하면 아래 패널이 열리고 오른쪽에 “+ 새 소모임 만들기” 버튼이 초록색으로 활성화됩니다.",
                        en: "Click an empty date and the panel below opens, with a green “+ New Meetup” button activated on the right." },
                notes: [
                    { ko: "소모임은 내일 이후 날짜부터 만들 수 있어요. 오늘이나 지난 날짜에는 버튼이 비활성화됩니다.",
                      en: "Meetups can only be created for tomorrow or later — the button stays disabled for today or any past date." },
                ],
            },
            {
                img: "03-fill-out-info.png",
                title: { ko: "소모임 정보를 입력해주세요.", en: "Fill in the meetup details." },
                body: { ko: "이름·시간·정원·장소·주최자·비밀번호·소개를 채워주세요. * 표시 항목은 필수예요. 정원은 본인을 포함해 3명 이상이어야 해요.",
                        en: "Fill in the name, time, capacity, location, host, password, and description. * marks a required field, and capacity must be at least 3 including yourself." },
                notes: [
                    { ko: "편집 비밀번호는 나중에 수정/삭제하거나 다른 기기에서 참가자 명단을 확인할 때 반드시 필요해요. 안전한 곳에 꼭 적어두세요.",
                      en: "Your edit password is required later to edit or delete the meetup, or view the participant list from another device. Write it down somewhere safe." },
                ],
            },
            {
                img: "04-pending-approval.png",
                title: { ko: "'관리자 승인 대기 중' 상태가 돼요.", en: "It starts out “Pending admin approval.”" },
                body: { ko: "등록된 소모임은 즉시 캘린더에 뜨지만, 상세 창 상단에 노란색 '관리자 승인 대기 중' 칩이 붙어요.",
                        en: "Your meetup shows up on the calendar right away, but a yellow “Pending admin approval” chip appears at the top of the detail window." },
                notes: [
                    { ko: "승인 전에는 주최자 외에는 신청할 수 없어요. 링크를 공유해도 다른 부원들은 신청 버튼이 보이지 않아요.",
                      en: "Until it's approved, only the host can join. Even if you share the link, other members won't see a sign-up button." },
                ],
            },
            {
                img: "05-kakaotalk-request.png",
                title: { ko: "단체 카카오톡방에서 승인을 요청해주세요.", en: "Request approval in the group KakaoTalk chat." },
                body: { ko: "상단의 공유 버튼(↑)을 누르면 소모임 정보와 신청 링크가 한 번에 정리된 텍스트가 복사돼요. 그대로 잡담방에 붙여넣어주세요.",
                        en: "Tap the share button (↑) at the top and a ready-made summary with the sign-up link gets copied. Paste it straight into the group chat." },
            },
            {
                img: "06-meetup-approved.png",
                title: { ko: "관리자가 승인하면 신청이 열려요.", en: "Once an admin approves it, sign-ups open." },
                body: { ko: "승인 대기 배지가 사라지고, 부원들이 링크를 통해 바로 신청할 수 있어요.",
                        en: "The pending-approval badge disappears, and members can sign up right through the link." },
            },
            {
                img: "07-people-signed-up.png",
                title: { ko: "신청이 들어오면 참가자 명단이 채워져요.", en: "As sign-ups come in, the participant list fills up." },
                body: { ko: "누군가 신청하면 초록 칩으로 이름이 추가돼요. 정원이 다 차면 상단 인원 칩이 붉은 빛으로 바뀌고 목록에는 '마감'이 붙어요.",
                        en: "Each sign-up adds a green chip with that person's name. Once full, the headcount chip turns red and the listing shows “Full.”" },
                notes: [
                    { ko: "다른 참가자가 있으면 소모임을 삭제할 수 없어요. 부득이하게 취소해야 한다면 참가자들에게 먼저 안내해주세요.",
                      en: "You can't delete a meetup once other people have signed up. If you need to cancel it, let participants know first." },
                ],
            },
            {
                img: "08-participant-contacts.png",
                title: { ko: "주최자는 참가자 연락처를 확인할 수 있어요.", en: "As host, you can view participants' contact info." },
                body: { ko: "‘참가자 연락처 보기’를 누르면 실명과 연락처가 표시돼요. 당일 위치 안내나 지각 연락이 필요할 때 사용해주세요.",
                        en: "Tap “View participant contacts” to see everyone's real name and contact info. Handy for location updates or late-arrival messages on the day." },
                notes: [
                    { ko: "다른 기기(휴대폰 등)에서는 연락처를 확인하기 전에 편집 비밀번호를 한 번 입력해야 해요.",
                      en: "On another device (like your phone), you'll need to enter the edit password once before viewing contacts." },
                ],
            },
            {
                img: "09-meetup-review.png",
                title: { ko: "소모임이 끝난 뒤에는 짧은 후기를 남겨주세요.", en: "After the meetup, please share a short review." },
                body: { ko: "단체 카톡방에 날짜·이름·인원과 함께 마셨던 차나 인상적인 순간을 몇 줄 남겨주세요. 사진도 함께 공유해주시면 좋아요!",
                        en: "In the group chat, share the date, name, and headcount along with a few lines about the tea or a memorable moment. Photos are welcome too!" },
            },
        ],
        join: [
            {
                img: "join-01-calendar-view.png",
                title: { ko: "소모임 신청 페이지에서 캘린더를 살펴봐주세요.", en: "Browse the calendar on the meetup sign-up page." },
                body: { ko: "열려 있는 소모임은 초록색 칩으로 날짜 아래에 이름이 표시돼요. 좌우 화살표로 다른 달을 살펴보고, '오늘' 버튼으로 오늘이 있는 달로 바로 돌아올 수 있어요.",
                        en: "Open meetups show up as green chips with their name under the date. Use the side arrows to browse other months, or tap “Today” to jump back." },
            },
            {
                img: "join-02-date-selection.png",
                title: { ko: "관심 있는 소모임이 열린 날짜를 클릭해주세요.", en: "Click the date of the meetup you're interested in." },
                body: { ko: "화면 아래 패널에 그 날의 소모임 카드가 뜹니다. 카드에는 이름·시간·장소·주최자가 요약되고, 오른쪽에는 현재 인원/정원 칩이 붙어요. 마감된 소모임은 그 자리에 '마감'이 표시됩니다.",
                        en: "That day's meetup card appears in the panel below, summarizing the name, time, location, and host, with a headcount/capacity chip on the right. Full meetups show “Full” instead." },
            },
            {
                img: "join-03-open-event.png",
                title: { ko: "소모임 카드를 눌러 상세 창을 열어주세요.", en: "Tap the meetup card to open its details." },
                body: { ko: "일시·장소·주최자·정원·소개와 참가자 목록을 확인할 수 있어요. '지도에서 보기'가 있으면 눌러서 정확한 위치를 확인할 수 있어요.",
                        en: "See the date/time, location, host, capacity, description, and the participant list. If there's a “View on map” link, tap it for the exact location." },
                notes: [
                    { ko: "신청은 소모임 전날까지만 받을 수 있어요. 소모임 당일에는 신청 폼이 사라지고 마감 안내만 뜹니다.",
                      en: "Sign-ups are only open through the day before the meetup. On the day itself, the form disappears and only a closed notice remains." },
                ],
            },
            {
                img: "join-04-signing-form.png",
                title: { ko: "신청 폼을 채워주세요.", en: "Fill out the sign-up form." },
                body: { ko: "이름(참가자 목록에 공개, 닉네임 가능), 실명(관리자 확인용), 연락처(주최자만, 선택), 취소 비밀번호를 입력해주세요.",
                        en: "Fill in your name (shown publicly, nickname ok), real name (for admin verification), contact info (host-only, optional), and a cancellation password." },
                notes: [
                    { ko: "취소 비밀번호는 다른 기기에서 취소할 때 반드시 필요해요. 잊어버리지 않을 값으로 설정해주세요.",
                      en: "Your cancellation password is required if you cancel from a different device. Choose something you'll remember." },
                ],
            },
            {
                img: "join-05-completion.png",
                title: { ko: "'신청하기'를 누르면 완료!", en: "Tap “Sign up” and you're done!" },
                body: { ko: "인원 칩이 늘어나고 참가자 목록에 이름이 추가돼요. 같은 기기에서는 '신청 취소하기' 링크로 바로 취소할 수 있고, 다른 기기에서 신청했다면 하단의 '비밀번호로 취소하기'를 눌러주세요.",
                        en: "The headcount chip goes up and your name is added to the participant list. Cancel right away on the same device with “Cancel my sign-up,” or use “Cancel with password” below on another device." },
                notes: [
                    { ko: "취소는 소모임 2일 전까지만 가능해요. 그 이후로는 취소 링크가 비활성화되니 주최자에게 직접 연락해주세요.",
                      en: "Cancellations are only open through 2 days before the meetup. After that the link is disabled — please contact the host directly." },
                ],
            },
        ],
    };

    // ---- state -----------------------------------------------------------
    let activeTab = "create";
    let idx = 0;

    // ---- DOM refs (filled once on init) ---------------------------------
    let overlay, tabsEl, imgEl, titleEl, bodyEl, notesEl, dotsEl, progressEl,
        prevBtn, nextBtn, closeBtn;

    function currentSlides() { return SLIDES[activeTab]; }

    function slideAria(n) {
        return (window.I18N ? window.I18N.t("join.help.slideAria", { n: n }) : "") || ("Slide " + n);
    }

    function render() {
        const slides = currentSlides();
        const slide = slides[idx];
        if (!slide) return;

        const title = pick(slide.title);

        imgEl.src = IMG_BASE + slide.img;
        imgEl.alt = title;
        titleEl.textContent = title;
        bodyEl.textContent = pick(slide.body);
        progressEl.textContent = (idx + 1) + " / " + slides.length;

        // yellow "!" callouts (0..n) — one <p class="join_help_note"> per note
        notesEl.innerHTML = "";
        (slide.notes || []).forEach(function (note) {
            const p = document.createElement("p");
            p.className = "join_help_note";
            p.textContent = pick(note);
            notesEl.appendChild(p);
        });

        // rebuild dots — cheap, only 5–9 of them
        dotsEl.innerHTML = "";
        for (let i = 0; i < slides.length; i++) {
            const d = document.createElement("button");
            d.type = "button";
            d.className = "join_help_dot" + (i === idx ? " is-active" : "");
            d.setAttribute("aria-label", slideAria(i + 1));
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
        notesEl    = overlay.querySelector(".join_help_notes");
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

        // re-render the current slide's text (and dot aria-labels) when the
        // site-wide language toggle flips, so a modal left open mid-read
        // doesn't go stale
        window.addEventListener("i18n:changed", function () {
            if (!overlay.hidden) render();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
