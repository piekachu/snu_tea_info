/* Site-wide Korean/English toggle.
 *
 * Markup:
 *   <h2 data-i18n="info.title">정보</h2>                 → textContent
 *   <p  data-i18n-html="join.demoBanner">…</p>           → innerHTML (text containing tags)
 *   <input data-i18n-attr="placeholder:join.titlePh">    → attributes, "attr:key" pairs
 *                                                          separated by "|"
 *   <title data-i18n="info.pageTitle">정보</title>
 *
 * From JS:
 *   I18N.t("join.loading")            → string in the active language
 *   I18N.t("chatjip.count", { n: 8 }) → "{n}" placeholders substituted
 *
 * Re-rendering dynamic content:
 *   window.addEventListener("i18n:changed", render)
 *
 * Missing or empty English falls back to Korean, so a partially translated
 * dictionary degrades to the original text instead of rendering blank.
 */
(function () {
    "use strict";

    var STORAGE_KEY = "snuTeaLang_v1";
    var DEFAULT_LANG = "ko";

    var DICT = {
        /* ── shared chrome ────────────────────────────────────────── */
        "footer.brand":        { ko: "설다연", en: "Seoldayeon" },
        "footer.desc":         { ko: "서울대학교 중앙 차동아리 설다연에 오신 것을 환영합니다!",
                                 en: "Welcome to Seoldayeon, Seoul National University's tea club!" },
        "footer.rights":       { ko: "© 2026 설다연. All rights reserved.",
                                 en: "© 2026 Seoldayeon. All rights reserved." },
        "footer.instagramNote": { ko: "문의사항은 인스타그램 DM으로 편하게 연락주세요!",
                                 en: "For any questions, feel free to reach out via DM on Instagram!" },
        "nav.more":            { ko: "더 알아보기", en: "Learn more" },
        "nav.backToInfo":      { ko: "정보 목록으로", en: "Back to Info" },
        "nav.backToNotice":    { ko: "공지사항 목록으로", en: "Back to Notices" },
        "a11y.prev":           { ko: "이전", en: "Previous" },
        "a11y.next":           { ko: "다음", en: "Next" },
        "a11y.prevMonth":      { ko: "이전 달", en: "Previous month" },
        "a11y.nextMonth":      { ko: "다음 달", en: "Next month" },
        "a11y.close":          { ko: "닫기", en: "Close" },
        "common.all":          { ko: "전체", en: "All" },
        "common.today":        { ko: "오늘", en: "Today" },
        "common.loading":      { ko: "불러오는 중...", en: "Loading..." },

        /* ── translation disclaimer popover (site-wide, next to the
              KOR/ENG toggle — see injectToggle() below). Only ever shown
              while lang === "en", but kept as a normal dict entry (with a
              Korean value too) for consistency with everything else here. */
        "lang.disclaimer.btnAria": { ko: "번역 안내", en: "About this translation" },
        "lang.disclaimer.title":   { ko: "번역 안내", en: "About this translation" },
        "lang.disclaimer.body":    { ko: "이 영문 번역은 영어 사용자의 편의를 위해 제공되며, 원문과 다소 차이가 있을 수 있습니다. 내용이 상충할 경우 한국어 원문이 우선합니다. 애매한 부분이 있다면 언제든 임원진에게 문의해주세요.",
                                     en: "This English translation is provided only for the convenience of English-speaking members, and may contain minor discrepancies from the original. Wherever the two disagree, the Korean text always takes precedence. If anything is unclear, please don't hesitate to reach out to our staff for help." },

        /* ── home ─────────────────────────────────────────────────── */
        "home.events.title":   { ko: "정기/특별다회", en: "Regular & Special Tea Sessions" },
        "home.events.intro":   { ko: "매 학기 종강·개강마다 열리는 정기다회와, 특별한 차로 꾸리는 특별다회를 만나보세요. 임원진이 준비한 다구와 차로 함께 마시는 자리이니, 편하게 신청하고 즐기시면 됩니다.",
                                 en: "Meet Seoldayeon's regular sessions (정기다회) — held at every semester's opening and closing — and its special-tea sessions (특별다회) built around a particular tea. The staff set up the tea and utensils, so all you need to do is show up." },
        "home.join.title":     { ko: "소모임 신청", en: "Meetups" },
        "home.join.intro":     { ko: "누구나 자유롭게 소모임을 만들고 참여할 수 있습니다. 차에 관심 있는 사람들이 모여 함께 취미를 나누고, 새로운 경험을 쌓을 수 있는 공간입니다. 원하는 날짜를 선택해 새로운 소모임을 시작하거나, 이미 만들어진 모임에 참가 신청을 해보세요!",
                                 en: "Anyone can start a meetup or join one. It's a space for people interested in tea to share the hobby and try something new. Pick a date to start your own, or sign up for one that's already been created." },
        "home.info.title":     { ko: "정보", en: "Info" },
        "home.info.intro":     { ko: "설다연에 관한 다양한 정보와 글을 만나보세요. 차 문화, 찻집 안내, 동아리 활동 이야기 등 유익한 내용을 공유합니다.",
                                 en: "Browse articles and guides about Seoldayeon — tea culture, tea house recommendations, and stories from club activities." },
        "home.notice.title":   { ko: "공지사항/FAQ", en: "Notices & FAQs" },
        "home.notice.intro":   { ko: "설다연의 소식과 공지사항을 놓치지 마세요. 정기 모임 일정, 회칙 안내, 신입 오티 정보 등 동아리 운영에 필요한 주요 소식과 자주 묻는 질문들을 확인할 수 있습니다.",
                                 en: "Keep up with news and announcements — meeting schedules, the club bylaws, new member orientation, and answers to frequently asked questions." },
        "carousel.upcomingEvents": { ko: "다가오는 행사", en: "Upcoming Events" },
        "carousel.upcomingJoin":   { ko: "다가오는 소모임", en: "Upcoming Meetups" },
        "carousel.recentInfo":     { ko: "최근 정보", en: "Recent Info" },
        "carousel.mainNotice":     { ko: "주요 공지", en: "Key Notices" },

        /* ── info listing ─────────────────────────────────────────── */
        "info.pageTitle":      { ko: "정보", en: "Info" },
        "info.title":          { ko: "정보", en: "Info" },
        "info.intro":          { ko: "설다연에 관한 다양한 정보와 글을 만나보세요.",
                                 en: "Browse articles and information about Seoldayeon." },
        "info.pinned":         { ko: "고정", en: "Pinned" },

        /* ── notice listing ───────────────────────────────────────── */
        "notice.pageTitle":    { ko: "공지사항/FAQ", en: "Notices & FAQs" },
        "notice.title":        { ko: "공지사항/FAQ", en: "Notices & FAQs" },
        "notice.intro":        { ko: "설다연의 공지사항을 확인하세요.",
                                 en: "Check the latest announcements from Seoldayeon." },

        /* ── events listing (event detail pages are intentionally untouched) ── */
        "events.pageTitle":    { ko: "Events", en: "Events" },
        "events.title":        { ko: "Events", en: "Events" },
        "events.calendarAria": { ko: "다과회 일정", en: "Tea gathering schedule" },

        /* ── tea info ─────────────────────────────────────────────── */
        "teaInfo.pageTitle":   { ko: "Tea Info", en: "Tea Info" },
        "teaInfo.title":       { ko: "Tea Info", en: "Tea Info" },
        "teaInfo.subtitle":    { ko: "Select a tea lineup to view:", en: "Select a tea lineup to view:" },

        /* ── 찻집 정보 ─────────────────────────────────────────────────
              Venue NAMES translate (see the nameEn field on each entry
              in chatjip-info.html's VENUES data, picked via I18N.pick).
              Addresses and the Naver Maps search query stay Korean on
              purpose — that's what actually resolves on the map. */
        "chatjip.pageTitle":   { ko: "찻집 정보 — 설다연", en: "Tea Houses — Seoldayeon" },
        "chatjip.title":       { ko: "찻집 정보", en: "Tea Houses" },
        "chatjip.badge":       { ko: "61곳", en: "61 places" },
        "chatjip.subtitle":    { ko: "설다연 부원들이 추천하는 서울·경기권 찻집 목록입니다. 네이버 지도 링크로 위치를 바로 확인할 수 있어요.",
                                 en: "Tea houses around Seoul and Gyeonggi recommended by Seoldayeon members. Each entry links straight to Naver Maps. Addresses stay in Korean so the map links keep working." },
        "chatjip.navAria":     { ko: "구별 지도 필터", en: "Filter map by district" },
        "chatjip.mapHintAll":  { ko: "전체 {n}곳 — 마커를 클릭하면 정보가 표시돼요",
                                 en: "All {n} places — click a marker for details" },
        "chatjip.mapHintOne":  { ko: "{d} {n}곳 — 마커를 클릭하면 정보가 표시돼요",
                                 en: "{d} · {n} places — click a marker for details" },
        "chatjip.count":       { ko: "{n}곳", en: "{n} places" },
        "chatjip.naverMap":    { ko: "네이버 지도", en: "Naver Map" },
        "chatjip.viewOnNaver": { ko: "네이버 지도에서 보기 →", en: "View on Naver Map →" },
        "chatjip.summary":     { ko: "총 <strong>61곳</strong>의 찻집 · <strong>17개</strong> 지역 수록 · 네이버 지도 링크로 바로 길찾기 가능",
                                 en: "<strong>61</strong> tea houses across <strong>17</strong> districts · directions via Naver Maps" },

        /* ── 소모임 신청 방법 (meetup sign-up manual) ─────────────────
              notice/meetup-signup.html. data-i18n-html is used wherever
              the Korean fallback contains inline tags (<strong>/<em>/<a>) —
              keep the English value's tags in sync if the Korean changes. */
        "meetup.pageTitle":     { ko: "소모임 신청 방법 — 공지사항", en: "How to Sign Up for a Meetup — Notices" },
        "meetup.title":         { ko: "소모임 신청 방법", en: "How to Sign Up for a Meetup" },
        "meetup.intro":         { ko: "설다연에서는 누구나 자유롭게 소모임을 열거나 참여할 수 있어요. 소모임 신청 페이지에서 <strong>새 소모임을 만드는 방법</strong>과 <strong>이미 열려 있는 소모임에 신청하는 방법</strong>을 순서대로 안내드릴게요.",
                                  en: "At Seoldayeon, anyone is free to start a meetup or join one. On the meetup sign-up page, we'll walk you through <strong>how to create a new meetup</strong> and <strong>how to sign up for one that's already open</strong>, step by step." },
        "meetup.tabsAria":      { ko: "소모임 신청 방법 섹션", en: "Meetup sign-up guide sections" },
        "meetup.tab.create":    { ko: "새 소모임 만들기", en: "Create a New Meetup" },
        "meetup.tab.join":      { ko: "이미 열린 소모임에 신청하기", en: "Sign Up for an Open Meetup" },

        "meetup.create.ariaLabel": { ko: "새 소모임 만들기", en: "Create a new meetup" },

        "meetup.create.step1.title": { ko: "소모임 신청 페이지를 열어주세요.", en: "Open the meetup sign-up page." },
        "meetup.create.step1.body":  { ko: "<a href=\"../join/index.html\" style=\"color: var(--osullocGreen); font-weight: 600;\">소모임 신청 페이지</a>에 들어가면 이번 달 캘린더가 보여요. 이미 열린 소모임은 초록색 칩으로 날짜 아래에 표시되고, 오늘 날짜에는 진한 초록 원이 둘러져요. 좌우의 <strong>&lt; &gt;</strong> 화살표로 다른 달을 살펴볼 수도 있고, 다른 달을 보다가 <strong>오늘</strong> 버튼을 누르면 오늘이 있는 달로 바로 돌아와요.",
                                       en: "Head over to the <a href=\"../join/index.html\" style=\"color: var(--osullocGreen); font-weight: 600;\">meetup sign-up page</a> and you'll see this month's calendar. Meetups that are already open show up as green chips under their date, and today's date gets a solid green circle. Use the <strong>&lt; &gt;</strong> arrows to browse other months, or tap <strong>Today</strong> to jump straight back to the current month." },
        "meetup.create.step1.imgAlt": { ko: "소모임 신청 페이지의 월간 캘린더 뷰", en: "Monthly calendar view of the meetup sign-up page" },

        "meetup.create.step2.title": { ko: "소모임을 열고 싶은 날짜를 골라주세요.", en: "Pick the date you'd like to open a meetup on." },
        "meetup.create.step2.body":  { ko: "달력에서 원하는 날짜를 클릭하면 그 셀에 연한 초록 배경이 씌워지고, 화면 아래쪽 패널에 그 날의 소모임 목록이 나타나요. 아직 열린 소모임이 없다면 <em>\"이 날짜에는 아직 소모임이 없어요. 첫 소모임을 만들어보세요!\"</em>라는 안내와 함께 오른쪽에 <strong>+ 새 소모임 만들기</strong> 버튼이 초록색으로 활성화됩니다. 소모임은 <strong>내일 이후 날짜</strong>부터 만들 수 있어요. 오늘이나 지난 날짜에는 <strong>+ 새 소모임 만들기</strong> 버튼이 비활성화됩니다.",
                                       en: "Click a date on the calendar and it gets a light green highlight, with that day's meetup list showing up in the panel below. If nothing's open yet, you'll see <em>\"No meetups on this day yet. Why not start the first one?\"</em> along with a green <strong>+ New Meetup</strong> button on the right. Meetups can only be created for <strong>tomorrow or later</strong> — the button stays disabled for today or any past date." },
        "meetup.create.step2.imgAlt": { ko: "빈 날짜를 선택해 + 새 소모임 만들기 버튼이 활성화된 모습", en: "An empty date selected, with the + New Meetup button now active" },

        "meetup.create.step3.title": { ko: "소모임 정보를 입력해주세요.", en: "Fill in the meetup details." },
        "meetup.create.step3.body":  { ko: "<strong>+ 새 소모임 만들기</strong>를 누르면 개설 창이 뜹니다. 소모임 이름, 시간(시·분 각각 선택), 정원, 장소, 지도 링크, 주최자 이름과 실명, 편집 비밀번호, 그리고 간단한 소개를 채워주세요. <em>*</em> 표시가 있는 항목은 필수예요. 정원은 <strong>본인을 포함해 3명 이상</strong>이어야 하고, 지도 링크는 선택 사항이지만 <em>네이버 지도 공유 링크</em>를 붙여넣으면 다른 부원들이 바로 길찾기를 할 수 있어요. 다 채웠다면 <strong>만들기</strong>를 누릅니다.",
                                       en: "Tapping <strong>+ New Meetup</strong> opens the creation form. Fill in the meetup name, time (hour and minute), capacity, location, a map link, your name and real name as host, an edit password, and a short description. <em>*</em> marks a required field. Capacity must be <strong>at least 3, including yourself</strong>, and while the map link is optional, pasting a <em>Naver Map share link</em> lets other members get directions instantly. Once everything's filled in, tap <strong>Create</strong>." },
        "meetup.create.step3.note":  { ko: "<strong>편집 비밀번호</strong>는 나중에 소모임을 수정·삭제하거나, 다른 기기에서 참가자 명단을 확인할 때 반드시 필요해요. 잊어버리면 관리자만 처리할 수 있으니 안전한 곳에 꼭 적어두세요.",
                                       en: "Your <strong>edit password</strong> is required later to edit or delete the meetup, or to view the participant list from another device. If you forget it, only an admin can help — so write it down somewhere safe." },
        "meetup.create.step3.imgAlt": { ko: "소모임 만들기 창의 입력 폼", en: "The meetup creation form" },

        "meetup.create.step4.title": { ko: "등록되면 '관리자 승인 대기 중' 상태가 돼요.", en: "Once created, it starts out “Pending admin approval.”" },
        "meetup.create.step4.body":  { ko: "방금 만든 소모임은 즉시 캘린더에 표시되지만, 상세 창 상단에 <em>1/3명</em> 옆으로 노란색 <strong>관리자 승인 대기 중</strong> 칩이 붙어요. 아래쪽에는 <em>\"이 소모임은 관리자의 승인이 완료된 후부터 신청받을 수 있어요.\"</em>라는 안내가 뜹니다.",
                                       en: "The moment you create it, your meetup shows up on the calendar — but a yellow <strong>Pending admin approval</strong> chip appears next to <em>1/3</em> at the top of the detail window. Below it you'll see <em>\"Sign-ups open once an admin approves this meetup.\"</em>" },
        "meetup.create.step4.note":  { ko: "<strong>승인 전에는 주최자 외에는 신청할 수 없어요.</strong> 링크를 공유해도 다른 부원들은 신청 버튼이 보이지 않아요.",
                                       en: "<strong>Until it's approved, only the host can join.</strong> Even if you share the link, other members won't see a sign-up button yet." },
        "meetup.create.step4.imgAlt": { ko: "관리자 승인 대기 중 배지가 붙은 소모임 상세 창", en: "Meetup detail window with the pending-approval badge" },

        "meetup.create.step5.title": { ko: "단체 카카오톡방에서 승인을 요청해주세요.", en: "Request approval in the group KakaoTalk chat." },
        "meetup.create.step5.body":  { ko: "상세 창 오른쪽 위의 <strong>공유 버튼(↑)</strong>을 누르면 소모임 정보와 신청 링크가 한 번에 정리된 텍스트가 클립보드에 복사돼요. 이 내용을 그대로 <strong>설다연 잡담방</strong>에 붙여넣고, 공유해주시면 됩니다! 관리자가 확인하는대로 승인만 처리되면 그 링크로 부원들이 바로 신청할 수 있어요.",
                                       en: "Tap the <strong>share button (↑)</strong> at the top right of the detail window and a ready-made summary of the meetup — plus the sign-up link — gets copied to your clipboard. Paste it straight into the <strong>Seoldayeon group chat</strong> to share it! As soon as an admin checks it and approves, members can sign up right through that link." },
        "meetup.create.step5.imgAlt": { ko: "복사한 소모임 정보를 카카오톡방에 붙여넣은 모습", en: "Copied meetup details pasted into the KakaoTalk group chat" },

        "meetup.create.step6.title": { ko: "관리자가 승인하면 신청이 열려요.", en: "Once an admin approves it, sign-ups open." },
        "meetup.create.step6.body":  { ko: "관리자가 승인하면 <em>관리자 승인 대기 중</em> 칩과 안내 문구가 사라지고, 상세 창은 일반 소모임과 같은 모습이 돼요. 이제부터 부원들이 링크를 통해 신청할 수 있어요. 소모임 카드에도 정원 인원 수(예: <em>1/3명</em>)만 남게 됩니다.",
                                       en: "Once approved, the <em>pending admin approval</em> chip and its notice disappear, and the detail window looks just like any other meetup. Members can now sign up through the link, and the meetup card just shows the headcount (e.g. <em>1/3</em>)." },
        "meetup.create.step6.imgAlt": { ko: "승인이 완료돼 신청을 받을 수 있게 된 소모임 상세 창", en: "Approved meetup detail window, now open for sign-ups" },

        "meetup.create.step7.title": { ko: "신청이 들어오면 참가자 명단이 채워져요.", en: "As sign-ups come in, the participant list fills up." },
        "meetup.create.step7.body":  { ko: "누군가 신청할 때마다 <strong>참가자 (n/m명)</strong> 아래의 초록 칩 목록에 이름이 하나씩 추가돼요. 정원이 모두 차면 상단 인원 칩이 <em>붉은 빛</em>으로 바뀌고, 캘린더 목록에서는 <em>마감</em> 표시가 뜹니다.",
                                       en: "Every time someone signs up, their name is added as a new green chip under <strong>Participants (n/m)</strong>. Once it's full, the headcount chip at the top turns <em>red</em>, and the calendar listing shows <em>Full</em>." },
        "meetup.create.step7.note":  { ko: "<strong>다른 참가자가 있으면 소모임을 삭제할 수 없어요.</strong> 부득이하게 취소해야 한다면 참가자들에게 먼저 안내한 뒤, 관리자에게 문의해주세요.",
                                       en: "<strong>You can't delete a meetup once other people have signed up.</strong> If you really need to cancel it, let the participants know first, then reach out to an admin." },
        "meetup.create.step7.imgAlt": { ko: "정원이 모두 채워진 소모임 상세 창", en: "Meetup detail window with a full participant list" },

        "meetup.create.step8.title": { ko: "주최자는 참가자 연락처를 확인할 수 있어요.", en: "As host, you can view participants' contact info." },
        "meetup.create.step8.body":  { ko: "상세 창 하단의 <strong>참가자 연락처 보기</strong>를 누르면 <em>참가자 연락처 (주최자 전용)</em> 박스가 열려요. 여기에는 각 참가자의 <strong>실명</strong>과 <strong>연락처</strong>가 표시됩니다 (입력하지 않은 참가자는 <em>연락처 미입력</em>으로 보여요).",
                                       en: "Tap <strong>View participant contacts</strong> at the bottom of the detail window to open the <em>Participant contacts (host only)</em> box. It shows each participant's <strong>real name</strong> and <strong>contact info</strong> (anyone who didn't provide one shows up as <em>No contact given</em>)." },
        "meetup.create.step8.note":  { ko: "소모임 주최자는 이걸 확인해서 늦지 않게 소모임 참가자들과 <strong>꼭 톡방을 개설</strong>하고, 약속 장소나 시간 등을 협의하면 됩니다! 혹시라도 인원이 생각한 만큼 많이 모이지 않았더라도, 신청자가 있다면 꼭 연락을 해서 모임 파투 여부를 알려주세요!",
                                       en: "As host, use this to <strong>set up a group chat</strong> with your participants in good time, and sort out the meeting spot and time together! And even if fewer people signed up than you'd hoped, please reach out to let them know whether the meetup is still happening." },
        "meetup.create.step8.imgAlt": { ko: "참가자 연락처 (주최자 전용) 박스가 열린 모습", en: "Open participant contacts (host only) box" },

        "meetup.create.step9.title": { ko: "소모임이 끝난 뒤에는 시음기를 공유해주세요.", en: "After the meetup, please share a tasting note." },
        "meetup.create.step9.body":  { ko: "소모임을 마친 후에는 <strong>설다연 잡담방</strong>에 소모임을 함께한 분들의 시음기를 모아서 공유해주세요! <em>날짜 · 함께 방문한 찻집 · 참여 인원</em>과 함께 마셨던 차에 대한 시음기를 사진과 같이 공유해주시면, 운영진 확인 이후 조원당 2500원의 지원금을 드립니다!",
                                       en: "Once your meetup wraps up, gather everyone's tasting notes and share them in the <strong>Seoldayeon group chat</strong>! Share the <em>date · tea house you visited · number of participants</em> along with a tasting note and photos of the tea, and once a staff member confirms it, each participant gets a <strong>₩2,500</strong> stipend!" },
        "meetup.create.step9.imgAlt": { ko: "소모임 후기를 단체 카톡방에 공유한 예시", en: "Example of a meetup review shared in the group chat" },

        "meetup.join.ariaLabel": { ko: "이미 열린 소모임에 신청하기", en: "Sign up for an open meetup" },

        "meetup.join.step1.title": { ko: "소모임 신청 페이지에서 캘린더를 살펴봐주세요.", en: "Browse the calendar on the meetup sign-up page." },
        "meetup.join.step1.body":  { ko: "<a href=\"../join/index.html\" style=\"color: var(--osullocGreen); font-weight: 600;\">소모임 신청 페이지</a>에 들어가면 이번 달 캘린더가 뜹니다. 열려 있는 소모임은 <strong>초록색 칩</strong>으로 날짜 아래에 이름이 표시돼요. 좌우 <strong>&lt; &gt;</strong> 화살표로 다른 달을 살펴볼 수 있고, <strong>오늘</strong> 버튼으로 오늘이 있는 달로 바로 돌아올 수 있어요.",
                                     en: "Head over to the <a href=\"../join/index.html\" style=\"color: var(--osullocGreen); font-weight: 600;\">meetup sign-up page</a> and you'll see this month's calendar. Open meetups show up as <strong>green chips</strong> with their name under the date. Use the <strong>&lt; &gt;</strong> arrows to browse other months, or tap <strong>Today</strong> to jump straight back to the current month." },
        "meetup.join.step1.imgAlt": { ko: "소모임 신청 페이지의 월간 캘린더 뷰", en: "Monthly calendar view of the meetup sign-up page" },

        "meetup.join.step2.title": { ko: "관심 있는 소모임이 열린 날짜를 클릭해주세요.", en: "Click the date of the meetup you're interested in." },
        "meetup.join.step2.body":  { ko: "소모임 이름이 붙어 있는 날짜를 누르면 그 셀에 연한 초록 배경이 씌워지고, 화면 아래쪽 패널에 그 날의 소모임 카드가 나타나요. 카드에는 소모임 <em>이름 · 시간 · 장소 · 주최자</em>가 요약되고, 오른쪽에는 <em>현재 인원 / 정원</em>이 초록 칩으로 붙어요. 정원이 모두 찼다면 그 자리에 <em>마감</em>이 표시됩니다.",
                                     en: "Clicking a date that has a meetup on it shows that day's meetup card in the panel below. Each card summarizes the <em>name · time · location · host</em>, with the <em>current headcount / capacity</em> shown as a green chip on the right. If it's full, that spot shows <em>Full</em> instead." },
        "meetup.join.step2.imgAlt": { ko: "소모임 카드가 표시된 날짜 패널", en: "Date panel showing a meetup card" },

        "meetup.join.step3.title": { ko: "소모임 카드를 눌러 상세 창을 열어주세요.", en: "Tap the meetup card to open its details." },
        "meetup.join.step3.body":  { ko: "카드를 누르면 상세 정보 창이 열려요. 상단에는 <strong>인원 칩</strong>과 <strong>공유 버튼(↑)</strong>이 있고, 그 아래로 <em>일시 · 장소 · 주최자 · 정원 · 소개</em>가 정리됩니다. <strong>지도에서 보기</strong>가 있으면 눌러서 정확한 위치를 확인할 수 있고, <strong>참가자 (n/m명)</strong> 아래의 초록 칩으로 지금까지 신청한 사람들의 이름을 볼 수 있어요.",
                                     en: "Tapping the card opens the detail window. Up top you'll find a <strong>headcount chip</strong> and a <strong>share button (↑)</strong>, and below that the <em>date/time · location · host · capacity · description</em>. If there's a <strong>View on map</strong> link, tap it to see the exact location, and the green chips under <strong>Participants (n/m)</strong> show who's signed up so far." },
        "meetup.join.step3.note":  { ko: "<strong>신청은 소모임 전날까지</strong>만 받을 수 있어요. 소모임 당일에는 신청 폼이 사라지고 마감 안내만 뜹니다. 뒤늦게 참여하고 싶다면 주최자에게 직접 연락해주세요.",
                                     en: "<strong>Sign-ups are only open through the day before the meetup.</strong> On the day of the meetup itself, the sign-up form disappears and only a closed notice remains. If you'd like to join at the last minute, please reach out to the host directly." },
        "meetup.join.step3.imgAlt": { ko: "소모임 상세 창과 신청 폼", en: "Meetup detail window with the sign-up form" },

        "meetup.join.step4.title": { ko: "신청 폼을 채워주세요.", en: "Fill out the sign-up form." },
        "meetup.join.step4.body":  { ko: "상세 창을 아래로 스크롤하면 신청 폼이 있어요. <strong>이름</strong>은 참가자 목록에 공개되는 이름이에요 (닉네임도 좋아요). <strong>실명</strong>은 관리자 확인용으로만 쓰이고 다른 참가자에게는 보이지 않아요. <strong>연락처</strong>는 선택 사항이지만, 카카오톡 ID나 전화번호를 남겨두면 주최자가 당일 위치 안내나 지각 연락을 줄 수 있어요 (주최자만 볼 수 있어요). 마지막으로 <strong>취소 비밀번호</strong>를 정해주세요.",
                                     en: "Scroll down in the detail window to find the sign-up form. <strong>Name</strong> is shown publicly in the participant list (a nickname is fine). <strong>Real name</strong> is for admin verification only and isn't shown to other participants. <strong>Contact info</strong> is optional, but leaving a KakaoTalk ID or phone number lets the host reach you about the location or a late arrival on the day (only the host can see it). Finally, set a <strong>cancellation password</strong>." },
        "meetup.join.step4.note":  { ko: "<strong>취소 비밀번호</strong>는 다른 기기(휴대폰, 다른 브라우저 등)에서 신청을 취소할 때 반드시 필요해요. 잊어버리면 취소하려면 주최자나 관리자에게 문의해야 하니, 기억할 수 있는 값으로 설정해주세요.",
                                     en: "Your <strong>cancellation password</strong> is required if you ever cancel from a different device (phone, another browser, etc.). If you forget it, you'll need to contact the host or an admin to cancel — so pick something memorable." },
        "meetup.join.step4.imgAlt": { ko: "이름·실명·연락처·취소 비밀번호를 채운 신청 폼", en: "Sign-up form filled in with name, real name, contact info, and cancellation password" },

        "meetup.join.step5.title": { ko: "\"신청하기\"를 누르면 완료!", en: "Tap “Sign up” and you're done!" },
        "meetup.join.step5.body":  { ko: "신청이 성공하면 상단 인원 칩이 <em>2/4명</em>처럼 늘어나고, 참가자 목록에 방금 입력한 이름이 새 초록 칩으로 추가돼요. 바로 아래에 <em>✅ (이름)님으로 신청 완료했어요.</em> 안내가 뜨고, 같은 기기에서는 <strong>신청 취소하기</strong> 링크로 바로 취소할 수 있어요.",
                                     en: "Once your sign-up goes through, the headcount chip at the top increases (e.g. to <em>2/4</em>), and your name is added to the participant list as a new green chip. Right below that you'll see <em>✅ You're signed up as (name).</em>, and on the same device you can cancel right away with the <strong>Cancel my sign-up</strong> link." },
        "meetup.join.step5.note1": { ko: "다른 기기에서 신청했거나 취소 링크가 보이지 않는다면, 상세 창 하단의 <strong>\"다른 기기에서 신청하셨나요? 비밀번호로 취소하기\"</strong>를 눌러 <em>실명 + 취소 비밀번호</em>로 취소할 수 있어요.",
                                     en: "Signed up on a different device, or don't see a cancel link? Tap <strong>“Did you sign up on a different device? Cancel with your password”</strong> at the bottom of the detail window to cancel using your <em>real name + cancellation password</em>." },
        "meetup.join.step5.note2": { ko: "<strong>취소는 소모임 2일 전까지</strong>만 가능해요. 그 이후에는 취소 링크가 비활성화되니, 부득이하게 못 가게 됐다면 주최자에게 직접 알려주세요.",
                                     en: "<strong>Cancellations are only open through 2 days before the meetup.</strong> After that the cancel link is disabled, so if something comes up, please let the host know directly." },
        "meetup.join.step5.imgAlt": { ko: "신청이 완료된 소모임 상세 창", en: "Meetup detail window after a completed sign-up" },

        "meetup.closing":       { ko: "<strong>궁금한 점이 있다면?</strong> 임원진에게 편하게 문의해주세요. 이 페이지는 소모임 신청이 처음이신 분들을 위한 안내이며, 실제 기능과 다르게 안내된 부분이 있다면 알려주세요.",
                                  en: "<strong>Have a question?</strong> Feel free to ask any staff member. This page is meant as a guide for members signing up for a meetup for the first time — if anything here doesn't match how it actually works, please let us know." },

        /* ── 신입부원 OT ──────────────────────────────────────────────
              notice/newmember-ot.html. Shared section-label keys
              (ot.label.*) repeat across several sections; everything
              else is one key per paragraph/title, namespaced by
              section. data-i18n-html is used wherever the Korean
              fallback has inline <strong>/<em>/<a> tags. */
        "ot.pageTitle":        { ko: "신입부원 OT 자료 — 공지사항", en: "New Member Orientation — Notices" },
        "ot.title":            { ko: "신입부원 OT 자료", en: "New Member Orientation" },
        "ot.empty":            { ko: "아직 등록된 내용이 없습니다.", en: "Nothing has been posted yet." },

        /* shared section-head labels (kicker text above each h4) */
        "ot.label.about":          { ko: "동아리 소개", en: "About the Club" },
        "ot.label.mainActivity":   { ko: "주요 활동", en: "Key Activities" },
        "ot.label.specialActivity": { ko: "특별활동", en: "Special Activity" },
        "ot.label.externalProgram": { ko: "외부 프로그램", en: "External Program" },
        "ot.label.reference":      { ko: "참고", en: "For Reference" },
        "ot.label.howToApply":     { ko: "지원 방법", en: "How to Apply" },

        /* 동아리 소개 */
        "ot.q1.title": { ko: "설다연은 어떤 동아리인가요?", en: "What kind of club is Seoldayeon?" },
        "ot.q1.p1":    { ko: "설다연은 서울대학교 유일의 중앙 차동아리입니다!", en: "Seoldayeon is the only university-wide tea club at Seoul National University!" },
        "ot.q1.p2":    { ko: "고정된 동아리방이 없는 대신, 서울 곳곳에 숨겨진 예쁜 찻집들을 직접 찾아다니며 차를 즐기는 매력적인 동아리예요.",
                         en: "Instead of a fixed clubroom, we're a club with real character — we seek out lovely, hidden tea houses all across Seoul and enjoy tea together there." },
        "ot.q1.p3":    { ko: "설다연에는 부원들이 함께 차를 즐길 수 있도록 다양한 활동들이 준비되어 있습니다!", en: "Seoldayeon has all kinds of activities lined up so members can enjoy tea together!" },
        "ot.q1.p4":    { ko: "<strong>차를 몰라도 활동에 전혀 지장이 없으니 부담 없이 지원해 주세요!</strong> 부원 대부분이 차와 처음 만나는 자리에서 시작합니다.",
                         en: "<strong>Not knowing anything about tea won't hold you back at all — please apply without any worry!</strong> Most members are meeting tea for the very first time when they start." },

        /* 정기다회 */
        "ot.regulars.title":   { ko: "정기다회", en: "Regular Tea Gathering (정기다회)" },
        "ot.regulars.imgAlt":  { ko: "정기다회에 모인 부원들", en: "Members gathered at a regular tea gathering" },
        "ot.regulars.p1":      { ko: "임원진이 주관하는 다회입니다. <strong>설다연에서 찻집을 통째로 대여해</strong> 소모임보다 많은 인원이 함께 모여 차를 마시며 친목을 나눕니다.",
                                  en: "This gathering is run by the club staff. <strong>Seoldayeon rents out an entire tea house</strong> so a larger group than a 소모임 can gather, drink tea together, and get to know one another." },
        "ot.regulars.p2":      { ko: "임원진이 다회 일정과 장소, 주제(차 종류 등)를 사전에 공지하고 참가 신청을 받아 인원을 확정합니다. 다회 당일에는 임원진이 준비한 다구와 차로 함께 차를 마시며 이야기를 나눕니다.",
                                  en: "Staff announce the date, location, and theme (type of tea, etc.) ahead of time and take sign-ups to lock in the headcount. On the day, everyone drinks tea together and chats, using the tea ware and tea the staff prepared." },

        /* 소모임 */
        "ot.somoim.title":       { ko: "소모임 · 3명 이상", en: "Meetup (소모임) · 3 or more people" },
        "ot.somoim.imgAlt":      { ko: "찻자리에 놓인 청화 개완", en: "A blue-and-white gaiwan set out for a tea gathering" },
        "ot.somoim.splitP":      { ko: "부원 누구나 자유롭게 열고 참여할 수 있는 가장 기본적인 활동입니다. 예전의 주간 조 배정 시스템은 사라졌고, 이제는 <a href=\"../join/index.html\">소모임 신청 페이지</a>에서 원하는 날짜에 직접 열거나 이미 열린 소모임에 신청하는 방식으로 운영됩니다.",
                                   en: "This is the most basic activity, and anyone is free to start or join one. The old weekly group-assignment system is gone — now it runs through the <a href=\"../join/index.html\">meetup sign-up page</a>, where you can open a meetup on any date you like, or sign up for one that's already open." },
        "ot.somoim.manualTitle": { ko: "소모임 신청 매뉴얼 바로가기", en: "Open the Meetup Sign-Up Manual" },
        "ot.somoim.manualBody":  { ko: "스크린샷과 함께 소모임 만들기·신청하기 전 과정을 자세히 안내해드려요.",
                                   en: "See the full step-by-step walkthrough — with screenshots — for creating a meetup and signing up for one." },

        /* 티 클래스 */
        "ot.teaclass.title":  { ko: "티 클래스", en: "Tea Class" },
        "ot.teaclass.imgAlt": { ko: "티 클래스에서 설명을 듣는 부원들", en: "Members listening to a talk at a tea class" },
        "ot.teaclass.p1":     { ko: "6대 다류와 다구를 소개하고 직접 시음하는 자리입니다. 차 문화와 종류에 대해 깊이 알아볼 수 있습니다.",
                                en: "A session introducing the six major tea types and tea ware, with tastings included — a great way to dig deeper into tea culture and varieties." },
        "ot.teaclass.p2":     { ko: "임원진이 클래스 일정과 주제를 사전에 공지하고 참가 신청을 받아 인원을 확정합니다. 당일에는 6대 다류(백차·녹차·황차·홍차·청차·흑차)와 다구를 함께 살펴보며 직접 시음하는 시간을 가집니다.",
                                en: "Staff announce the class schedule and topic ahead of time and take sign-ups to lock in the headcount. On the day, everyone looks over the six major tea types (white, green, yellow, black, oolong, and dark tea) and tea ware together, with time set aside for tasting." },
        "ot.teaclass.p3":     { ko: "지난 학기에는 6대 다류 이외에도 <em>티 블렌딩 · 자사호 · 보이차</em> 등 다양한 주제의 클래스가 진행되었습니다.",
                                en: "Last semester's classes also covered <em>tea blending, Yixing teapots, and pu-erh tea</em> alongside the six major types." },

        /* 제다여행 */
        "ot.teatrip.title":    { ko: "제다여행", en: "Tea-Making Trip (제다여행)" },
        "ot.teatrip.imgAlt1":  { ko: "하동 차 밭에서 찻잎을 따는 부원들", en: "Members picking tea leaves in a Hadong tea field" },
        "ot.teatrip.imgAlt2":  { ko: "갓 딴 찻잎이 담긴 대나무 소쿠리", en: "Freshly picked tea leaves in a bamboo basket" },
        "ot.teatrip.p1":       { ko: "1학기 활동의 하이라이트. 1박 2일 일정으로 경상남도 하동의 차 산지를 방문해 차 생산 과정을 직접 체험합니다. 연 1회 진행됩니다.",
                                  en: "The highlight of the spring semester. Over a 1-night, 2-day trip, we visit tea-growing regions in Hadong, Gyeongsangnam-do, and experience the tea-making process firsthand. Held once a year." },
        "ot.teatrip.p2":       { ko: "학기 초에 참가 신청을 받아 인원을 확정한 뒤, 5월 중 1박 2일 일정으로 하동군을 방문합니다. 차 밭과 제다 공장을 견학하고 차 만드는 과정을 직접 체험하며, 여행 후에는 사진과 후기를 함께 나눕니다.",
                                  en: "Sign-ups are taken early in the semester to lock in the headcount, then the trip to Hadong runs over 1 night and 2 days in May. We tour tea fields and tea-processing workshops, try our hand at making tea, and share photos and stories together afterward." },

        /* 연합활동 */
        "ot.joint.title": { ko: "연합활동", en: "Joint Activities" },
        "ot.joint.p1":    { ko: "<strong>매 학기마다</strong> 연세대학교 관설차회, 이화여자대학교 홍작 등 타 학교 차 동아리와 교류하는 활동입니다. 교류다회, 부스 방문 등 다양한 형식으로 진행됩니다.",
                             en: "<strong>Every semester</strong>, we exchange visits with tea clubs at other universities, including Yonsei University's Gwanseolchahoe and Ewha Womans University's Hongjak. These take the form of joint tea gatherings, booth visits, and more." },
        "ot.joint.p2":    { ko: "양 동아리 임원진이 교류 일정과 형식을 조율한 뒤, 교류다회나 부스 방문 등 함께할 프로그램을 진행합니다. 활동 후에는 사진과 소감을 함께 나눕니다.",
                             en: "Staff from both clubs coordinate a schedule and format, then run a joint tea gathering, booth visit, or other shared program together. Afterward, everyone shares photos and thoughts." },

        /* MT */
        "ot.mt.title": { ko: "MT", en: "Club Retreat (MT)" },
        "ot.mt.p":     { ko: "학기마다 부원 전체가 함께하는 1박 2일 엠티가 준비되어 있습니다. 2026-2학기에는 <strong>9월 18일(금) ~ 19일(토)</strong>로 예정되어 있어요. 자세한 장소·회비·프로그램은 확정되는 대로 단체 카카오톡방과 인스타그램을 통해 공지드립니다.",
                         en: "Every semester there's a 1-night, 2-day retreat for the whole club. For the 2026 Fall semester it's scheduled for <strong>September 18 (Fri) – 19 (Sat)</strong>. Details on location, cost, and program will be announced through the group KakaoTalk chat and Instagram once confirmed." },

        /* 티 블렌딩 */
        "ot.blending.title":   { ko: "티 블렌딩", en: "Tea Blending" },
        "ot.blending.p":       { ko: "여러 재료를 조합해 나만의 블렌딩 티를 만들어보는 특별 활동입니다. 준비된 꽃잎, 과일, 향신료를 취향대로 담아 우려내며 조합의 재미를 나눕니다.",
                                  en: "A special activity where you combine different ingredients to create your own blended tea. Mix in flower petals, fruit, and spices to your taste and brew them up — it's all about the fun of combining flavors." },
        "ot.blending.imgAlt1": { ko: "티 블렌딩에 쓰인 여러 재료들", en: "Various ingredients used for tea blending" },
        "ot.blending.imgAlt2": { ko: "블렌딩한 티를 우려낸 모습", en: "A brewed cup of blended tea" },

        /* 이도옥션 */
        "ot.leedo.title":  { ko: "이도옥션", en: "Yido Auction (이도옥션)" },
        "ot.leedo.p":      { ko: "인사동 소재의 도자기 업체 <em>이도옥션</em>이 매달 마지막 주에 학생들을 초대해주십니다. 사장님의 재능기부로 한반도의 옛 차 도구를 소개받고 함께 차를 마시는 시간을 가집니다.",
                              en: "<em>Yido Auction</em>, a ceramics business in Insadong, invites students in on the last week of every month. Through the owner's generosity, we get introduced to traditional Korean tea ware and enjoy tea together." },
        "ot.leedo.imgAlt": { ko: "이도옥션에서 옛 차 도구로 차를 우리는 모습", en: "Brewing tea with traditional tea ware at Yido Auction" },

        /* 알아두면 좋은 규칙 */
        "ot.rules.title":              { ko: "알아두면 좋은 규칙", en: "Good Rules to Know" },
        "ot.rules.noShow.title":       { ko: "소모임 불참비 · 2,500원", en: "Meetup No-Show Fee · ₩2,500" },
        "ot.rules.noShow.body":        { ko: "취소 마감(모임 2일 전) 이후 파토 시 부과됩니다. 신청 페이지의 취소 링크가 잠긴 뒤에는 주최자에게 먼저 양해를 구하시고, 회계부장에게 개인톡으로 연락 부탁드립니다.",
                                          en: "Charged if you back out after the cancellation deadline (2 days before the meetup). Once the cancel link on the sign-up page is locked, please ask the host for understanding first, then contact the treasurer directly." },
        "ot.rules.regularsNoShow.title": { ko: "정기다회 불참비 · 5,000원", en: "Regular Gathering No-Show Fee · ₩5,000" },
        "ot.rules.regularsNoShow.body":  { ko: "당일 파토 시 부과됩니다. 사정이 있으신 경우 사전에 알려주세요.",
                                            en: "Charged if you back out on the day itself. If something comes up, please let us know ahead of time." },
        "ot.rules.twoLeft.title":      { ko: "두 명이 남은 경우", en: "When Only Two People Are Left" },
        "ot.rules.twoLeft.body":       { ko: "소모임은 3명 이상을 원칙으로 하지만, 참가자 불참으로 두 명만 남게 된 경우에는 <em>모임 무산 · 두 분이서 진행</em> 중 하나를 선택하실 수 있습니다. 두 분이 진행하시는 경우에도 지원금은 동일하게 지급됩니다. 모임이 무산되더라도 불참비는 원인을 제공한 분들만 부담합니다.",
                                          en: "A meetup is meant to have 3 or more people, but if a no-show leaves only two, you can choose either to <em>cancel the meetup or go ahead with just the two of you</em>. If you go ahead with two, the same stipend is still paid. If the meetup is cancelled, only the people responsible for the no-show cover the fee." },

        /* 활동비 */
        "ot.fee.title": { ko: "활동비", en: "Membership Dues" },
        "ot.fee.p1":    { ko: "한 학기 회비는 <strong>25,000원</strong>입니다. 지원 시 구글폼 안내에 따라 입금해주시면 신청이 완료됩니다.",
                           en: "Semester dues are <strong>₩25,000</strong>. Once you pay according to the Google Form's instructions when applying, your application is complete." },
        "ot.fee.p2":    { ko: "소모임에 한 번 참여할 때마다 회비에서 <strong>2,500원</strong>의 활동 지원금이 지급됩니다.",
                           en: "Every time you take part in a meetup, you get a <strong>₩2,500</strong> activity stipend out of the dues." },
        "ot.fee.p3":    { ko: "그 외 회비는 시험기간 이벤트, 단체 활동(티 클래스, 교류다회 등) 지원에 사용됩니다.",
                           en: "The rest of the dues go toward exam-period events and support for group activities (tea classes, joint gatherings, etc.)." },

        /* 지원 방법 */
        "ot.apply.title": { ko: "신입부원 상시모집", en: "New Members — Rolling Admissions" },
        "ot.apply.p1":    { ko: "설다연 인스타그램 <a href=\"https://www.instagram.com/snu_dado/\" target=\"_blank\" rel=\"noopener noreferrer\">@snu_dado</a> 프로필 링크를 통해 구글폼을 제출해주시면 됩니다. 구글폼 안내에 따라 <strong>학기 회비 25,000원</strong>을 입금하시면 신청이 완료됩니다.",
                             en: "Submit the Google Form linked in our Instagram profile, <a href=\"https://www.instagram.com/snu_dado/\" target=\"_blank\" rel=\"noopener noreferrer\">@snu_dado</a>. Once you pay the <strong>semester dues of ₩25,000</strong> as instructed on the form, your application is complete." },
        "ot.apply.p2":    { ko: "문의사항은 회장 이준성 (<a href=\"tel:010-6717-7582\">010-6717-7582</a>) 또는 인스타그램 <a href=\"https://www.instagram.com/snu_dado/\" target=\"_blank\" rel=\"noopener noreferrer\">@snu_dado</a> DM으로 편하게 연락주세요.",
                             en: "For questions, feel free to reach out to club president Junseong Lee (<a href=\"tel:010-6717-7582\">010-6717-7582</a>) or DM <a href=\"https://www.instagram.com/snu_dado/\" target=\"_blank\" rel=\"noopener noreferrer\">@snu_dado</a> on Instagram." },

        "ot.closing":     { ko: "<strong>환영합니다!</strong> 궁금한 점은 언제든 임원진에게 편하게 물어보세요.",
                             en: "<strong>Welcome!</strong> Feel free to ask any staff member if you have questions." },

        /* ── 회칙 / bylaws ────────────────────────────────────────────
           English intentionally left empty — the club will supply it.
           Until then these fall back to the Korean text. */
        "bylaws.pageTitle":    { ko: "설다연 회칙 — 공지사항", en: "" },
        "bylaws.title":        { ko: "설다연 회칙", en: "" },
        "bylaws.pendingNote":  { ko: "", en: "An English translation of the bylaws has not been written yet. The Korean text below is the authoritative version." },
        /* Every block below is wired and waiting for its English text. Fill in
           the empty en values; anything still empty keeps showing the Korean. */
        "bylaws.docTitle": { ko: "설다연 회칙", en: "" },
        "bylaws.docDate": { ko: "2026.03.17. [1판]", en: "" },
        "bylaws.ch1": { ko: "제1장 총칙", en: "" },
        "bylaws.ch1.art1.title": { ko: "제1조 명칭", en: "" },
        "bylaws.ch1.art1.p1": { ko: "본 동아리는 ‘설다연’이라 칭한다.", en: "" },
        "bylaws.ch1.art2.title": { ko: "제2조 목적", en: "" },
        "bylaws.ch1.art2.p1": { ko: "본 동아리는 회원 간의 친목 도모 및 다도 등 차 문화 활동을 목적으로 하며, 서울대학교 총동아리연합회 산하 정등록 동아리로서 학생 자치 활동의 원칙을 준수한다.", en: "" },
        "bylaws.ch1.art3.title": { ko: "제3조 정의", en: "" },
        "bylaws.ch1.art3.p1": { ko: "본 회칙에서 사용하는 용어의 뜻은 다음과 같다.", en: "" },
        "bylaws.ch1.art3.p2": { ko: "① “회원”이란 제4조의 자격을 갖추어 본 동아리에 가입한 자를 말한다.", en: "" },
        "bylaws.ch1.art3.p3": { ko: "② “정규 활동”이란 동아리에서 활동 지원비를 전액 또는 일부 지원하는 모든 활동을 말한다.", en: "" },
        "bylaws.ch1.art3.p4": { ko: "③ “학기”의 시작일과 종료일은 서울대학교 학사일정상 명시된 날짜를 따른다.", en: "" },
        "bylaws.ch2": { ko: "제2장 회원", en: "" },
        "bylaws.ch2.art1.title": { ko: "제4조 자격", en: "" },
        "bylaws.ch2.art1.p1": { ko: "① 본 동아리의 회원은 서울대학교 학부 및 대학원에 재학 또는 휴학 중인 자(학생 신분)로 한정한다.", en: "" },
        "bylaws.ch2.art1.p2": { ko: "② 가입 시 학부생과 대학원생의 신분을 구분하여 명부에 기록한다.", en: "" },
        "bylaws.ch2.art2.title": { ko: "제5조 권리와 의무", en: "" },
        "bylaws.ch2.art2.p1": { ko: "① 회원은 이 회칙이 정하는 바에 따라 동아리의 모든 정규 활동에 참여할 권리를 가진다.", en: "" },
        "bylaws.ch2.art2.p2": { ko: "② 회원은 다음 각 호의 의무를 진다.", en: "" },
        "bylaws.ch3": { ko: "제3장 임원진 및 기구", en: "" },
        "bylaws.ch3.art1.title": { ko: "제6조 구성", en: "" },
        "bylaws.ch3.art1.p1": { ko: "본 동아리의 원활한 운영을 위하여 1명의 회장과 약간 명의 운영진을 둔다.", en: "" },
        "bylaws.ch3.art2.title": { ko: "제7조 선출 및 임기", en: "" },
        "bylaws.ch3.art2.p1": { ko: "① 회장은 동아리에 대한 기여도와 리더십을 고려하여 전임 회장의 지명 및 운영진 과반수의 동의로 선출한다.", en: "" },
        "bylaws.ch3.art2.p2": { ko: "② 운영진은 회장이 필요에 따라 임명한다.", en: "" },
        "bylaws.ch3.art2.p3": { ko: "③ 회장과 운영진의 임기는 1학기로 하되, 연임할 수 있다.", en: "" },
        "bylaws.ch3.art3.title": { ko: "제8조 권한", en: "" },
        "bylaws.ch3.art3.p1": { ko: "회장 및 운영진은 동아리 행사 기획, 회원 관리, 회칙 해석 및 징계, 재정 관리 등 동아리 운영에 관한 전반적인 권한을 갖는다.", en: "" },
        "bylaws.ch3.art4.title": { ko: "제9조 운영진 회의", en: "" },
        "bylaws.ch3.art4.p1": { ko: "① 운영진 회의는 회장이 소집하며, 회장과 운영진으로 구성한다.", en: "" },
        "bylaws.ch3.art4.p2": { ko: "② 운영진 회의는 재적 운영진(회장을 포함한다) 과반수의 출석으로 개회하고, 출석 운영진 과반수의 찬성으로 의결한다.", en: "" },
        "bylaws.ch4": { ko: "제4장 재정", en: "" },
        "bylaws.ch4.art1.title": { ko: "제10조 재원", en: "" },
        "bylaws.ch4.art1.p1": { ko: "본 동아리의 재정은 회원들이 납부하는 가입비와 그 밖의 지원금으로 충당한다.", en: "" },
        "bylaws.ch4.art2.title": { ko: "제11조 관리", en: "" },
        "bylaws.ch4.art2.p1": { ko: "① 재정은 회장 및 운영진의 권한과 책임 하에 자율적으로 수합, 집행, 관리한다.", en: "" },
        "bylaws.ch4.art2.p2": { ko: "② 동아리 자금을 지출할 때에는 그 목적과 금액을 반드시 별도의 회계장부에 기록해 두어야 한다.", en: "" },
        "bylaws.ch4.art2.p3": { ko: "③ 회원은 매 학기 마지막 주에 운영진에게 요구하여 회계장부를 자유롭게 열람할 수 있다.", en: "" },
        "bylaws.ch4.art3.title": { ko: "제12조 가입비", en: "" },
        "bylaws.ch4.art3.p1": { ko: "① 가입비는 학기 시작 시점의 회계 사정에 따라 회장 및 운영진이 정하며, 해당 학기에 가입하는 모든 회원에게 동일하게 적용된다.", en: "" },
        "bylaws.ch4.art3.p2": { ko: "② 가입비의 환불은 활동 참여 이력이 없는 회원에 한해 가입비를 납부하고 단체 소통방에 초대된 날로부터 7일 이내에만 유효하다.", en: "" },
        "bylaws.ch4.art4.title": { ko: "제13조 불참비", en: "" },
        "bylaws.ch4.art4.p1": { ko: "① 회장 및 운영진은 정규 활동의 원활한 운영을 위해, 사전 공지된 기한 이후 일방적인 불참을 통보한 회원에게 해당 활동에 대한 불참비를 부과할 수 있다.", en: "" },
        "bylaws.ch4.art4.p2": { ko: "② 불참비 부과 기준과 액수는 학기 시작 시에 공지하며, 정규 활동에 참석을 신청한 모든 회원은 해당 공지에 동의한 것으로 본다.", en: "" },
        "bylaws.ch4.art4.p3": { ko: "③ 불참비를 납부하지 않은 회원은 미납 기간 동안 동아리 활동 참여가 제한된다.", en: "" },
        "bylaws.ch5": { ko: "제5장 자격 상실 및 징계", en: "" },
        "bylaws.ch5.art1.title": { ko: "제14조 자격의 자동 상실", en: "" },
        "bylaws.ch5.art1.p1": { ko: "① 회원이 제4조 제1항에 따른 학생 신분을 상실한 경우, 그 회원의 자격은 별도의 의결 없이 자동으로 상실된다.", en: "" },
        "bylaws.ch5.art1.p2": { ko: "② 탈퇴 의사를 밝혀 가입비를 환불받은 회원은 즉시 자격을 상실한 것으로 본다.", en: "" },
        "bylaws.ch5.art2.title": { ko: "제15조 징계", en: "" },
        "bylaws.ch5.art2.p1": { ko: "① 회원이 다음 각 호의 어느 하나에 해당하는 경우, 운영진 회의는 그 회원에 대하여 경고 또는 제명(회원 자격 박탈)의 징계를 의결할 수 있다.", en: "" },
        "bylaws.ch5.art2.p2": { ko: "② 징계의 의결은 제9조 제2항의 정족수에 따른다.", en: "" },
        "bylaws.ch5.art3.title": { ko: "제16조 소명", en: "" },
        "bylaws.ch5.art3.p1": { ko: "운영진 회의는 제15조에 따른 징계를 의결하기 전에 해당 회원에게 징계 사유를 명확히 통보하고, 3일의 기한을 두어 서면 또는 대면으로 소명(해명)할 기회를 부여하여야 한다. 다만, 해당 회원이 소명을 거부하거나 기한 내에 응답하지 아니하는 경우에는 소명할 의사가 없는 것으로 본다.", en: "" },
        "bylaws.ch5.art4.title": { ko: "제17조 징계의 효력", en: "" },
        "bylaws.ch5.art4.p1": { ko: "① 경고를 받은 회원이 동일 또는 유사한 사유로 다시 징계 사유에 해당하는 경우, 운영진 회의는 이를 가중하여 징계할 수 있다.", en: "" },
        "bylaws.ch5.art4.p2": { ko: "② 제명된 회원은 즉시 단체 소통방에서 퇴장 조치되고 명부에서 삭제된다.", en: "" },
        "bylaws.ch6": { ko: "부칙", en: "" },
        "bylaws.ch6.art1.title": { ko: "제1조 효력 발생", en: "" },
        "bylaws.ch6.art1.p1": { ko: "① 본 회칙은 공포된 날부터 3일 후에 효력이 발생한다.", en: "" },
        "bylaws.ch6.art1.p2": { ko: "② 회칙 공포는 매 학기 1회 전체 공지방에 게시하고 가입신청서에 첨부함으로써 이루어진다.", en: "" },
        "bylaws.ch6.art2.title": { ko: "제2조 회칙 개정", en: "" },
        "bylaws.ch6.art2.p1": { ko: "회칙의 개정은 운영진의 발의로 시작하여 운영진 회의 과반수의 찬성으로 의결한다. 개정된 회칙은 공포된 날부터 3일 후에 효력이 발생한다.", en: "" },
        "bylaws.ch6.art3.title": { ko: "제3조 관례 적용", en: "" },
        "bylaws.ch6.art3.p1": { ko: "본 회칙에 명시되지 않은 사항은 서울대학교 총동아리연합회 회칙 및 세칙, 그리고 일반적인 통상 관례와 운영진의 합의에 따른다.", en: "" },
        "bylaws.ch2.art2.li1": { ko: "본 회칙을 준수할 의무", en: "" },
        "bylaws.ch2.art2.li2": { ko: "회원 자격을 유지하기 위하여 학기마다 소정의 가입비를 납부할 의무", en: "" },
        "bylaws.ch2.art2.li3": { ko: "동아리의 명예를 훼손하거나 회원 간의 화합을 저해하는 행위를 하지 아니할 의무", en: "" },
        "bylaws.ch5.art2.li1": { ko: "다른 회원에 대한 폭언, 과격한 언행, 차별적 발언 등으로 동아리 내에 심각한 불화나 위화감을 조성한 경우", en: "" },
        "bylaws.ch5.art2.li2": { ko: "동아리 및 운영진의 정당한 행정 지침이나 통제에 지속적으로 불응하여 운영을 심각하게 방해한 경우", en: "" },
        "bylaws.ch5.art2.li3": { ko: "그 밖에 동아리의 명예를 심대하게 실추시킨 경우", en: "" },

        /* ── shared list/card chrome (info + notice listings) ─────── */
        "common.pinned":       { ko: "고정", en: "Pinned" },
        "info.empty":          { ko: "등록된 정보 글이 없어요.", en: "No info posts yet." },
        "info.emptyCarousel":  { ko: "아직 등록된 정보 글이 없어요.", en: "No info posts yet." },
        "notice.empty":        { ko: "등록된 공지가 없어요.", en: "No notices yet." },
        "notice.emptyCarousel":{ ko: "아직 등록된 공지가 없어요.", en: "No notices yet." },
        "notice.loadError":    { ko: "글을 불러오지 못했어요. 링크를 다시 확인해주세요.", en: "Couldn't load this post. Please check the link." },
        "info.loadError":      { ko: "글을 불러오지 못했어요. 링크를 다시 확인해주세요.", en: "Couldn't load this post. Please check the link." },
        "events.loadError":    { ko: "행사를 불러오지 못했어요. 링크를 다시 확인해주세요.", en: "Couldn't load this event. Please check the link." },

        // events/view.html — 다회 정보/차 정보 toggle, the info-card labels,
        // and the fixed guidelines block every event page opens its tea
        // lineup with. The hand-authored event pages (eventTemplate,
        // 2026julyRegulars, …) keep this same text hardcoded in Korean only
        // — out of scope here, since making those bilingual too would mean
        // reworking every existing event page, not just this one.
        "events.infoTab":          { ko: "다회 정보", en: "Event Info" },
        "events.teaTab":           { ko: "차 정보", en: "Tea Info" },
        // status badge (예정/종료) shown on carousel cards (home + Events
        // page, both static and admin-created events — events-carousel.js)
        // and on this page's own info card. Not applied to the hand-
        // authored event subpages' own badge (events-meta.js) — same
        // Korean-only scoping as everything else above.
        "events.statusUpcoming":  { ko: "예정", en: "Upcoming" },
        "events.statusClosed":    { ko: "종료", en: "Closed" },
        "events.metaDateTime":     { ko: "일시", en: "Date & Time" },
        "events.metaVenue":        { ko: "장소", en: "Venue" },
        "events.metaFee":          { ko: "참가비", en: "Fee" },
        "events.metaCapacity":     { ko: "인원", en: "Capacity" },
        "events.metaCapacityValue":{ ko: "{n}명", en: "{n} people" },
        "events.brewMethod":       { ko: "차 우림법", en: "Brewing Method" },
        "events.guidelinesTitle":  { ko: "즐거운 다회를 위한 유의사항", en: "Guidelines for an Enjoyable Tea Gathering" },
        "events.guideline1Body":   { ko: "즐거운 다회를 즐기기 위해서 다음 수칙들을 한번씩 읽어주세요.<br> 언제든지 필요한 것이 있으시다면 주변의 운영진을 찾아주시면 언제든 기쁜 마음으로 도와드립니다.",
                                     en: "Please take a moment to read through the following guidelines to help make the gathering enjoyable for everyone.<br>If you ever need anything, feel free to find one of the staff nearby — we're always glad to help." },
        "events.guideline2Title":  { ko: "뜨거운 물을 조심해주세요!", en: "Watch out for hot water!" },
        "events.guideline2Body":   { ko: "뜨거운 물이 항상 함께하기 때문에 혹시라도 쏟지 않도록 항상 주의해주세요.",
                                     en: "Hot water is always close at hand, so please be careful not to spill it." },
        "events.guideline3Title":  { ko: "깨지기 쉬운 다구들에 주의해주세요!", en: "Handle the fragile tea ware with care!" },
        "events.guideline3Body":   { ko: "찻잔, 개완, 공도배 같은 도구들은 모두 깨지기 쉬워요.<br class=\"w_view\">항상 신경써서 조심스럽게 다뤄주세요.",
                                     en: "Teacups, gaiwans, and pitchers are all fragile.<br class=\"w_view\">Please handle them gently and with care." },
        "events.guideline4Title":  { ko: "차는 즐거운 마음으로 마실 때 가장 맛있습니다!", en: "Tea tastes best when enjoyed with a happy heart!" },
        "events.guideline4Body":   { ko: "소개된 우림법과 같은 정석적인 방법들에 너무 얽매이실 필요 없습니다.<br>좋은 사람들과 웃으며 즐기는 차가 제일 맛있습니다!<br class=\"m_view\">항상 가볍고 즐거운 마음으로 즐겨주세요.",
                                     en: "You don't need to feel bound by formal brewing methods like the ones introduced here.<br>Tea tastes best shared with good company and laughter!<br class=\"m_view\">Please enjoy it in a light and cheerful spirit." },

        /* ── 소모임 / join ───────────────────────────────────────── */
        "join.pageTitle":      { ko: "소모임 신청", en: "Meetup Sign-up" },
        "join.title":          { ko: "소모임 신청", en: "Meetup Sign-up" },
        "join.intro":          { ko: "원하는 날짜를 골라 새로운 소모임을 열거나, 이미 열린 소모임에 참가 신청을 해보세요. 누구나 자유롭게 만들고 신청할 수 있어요.",
                                 en: "Pick a date to open a new meetup, or sign up for one that's already been created. Anyone is welcome to host or join." },
        "join.demoBanner":     { ko: "데모 모드로 실행 중이에요 — 지금 만든 소모임과 신청은 <strong>이 브라우저에만</strong> 저장돼요. 모두에게 공유되려면 <code>apps-script/SETUP.md</code> 안내에 따라 배포를 완료해주세요.",
                                 en: "Running in demo mode — meetups and sign-ups you create are stored <strong>in this browser only</strong>. To share them with everyone, finish the deployment described in <code>apps-script/SETUP.md</code>." },
        "join.loadError":      { ko: "정보를 불러오지 못했어요. 새로고침 해주세요.",
                                 en: "Couldn't load. Please refresh the page." },
        "join.createBtn":      { ko: "+ 새 소모임 만들기", en: "+ New meetup" },
        "join.createTile":     { ko: "새 소모임 만들기", en: "Create a meetup" },
        "join.closed":         { ko: "마감", en: "Full" },
        "join.signupCount":    { ko: "신청 {n}명", en: "{n} signed up" },
        "join.capacity":       { ko: "{n}/{cap}명", en: "{n}/{cap}" },
        "join.hostPrefix":     { ko: "주최: {name}", en: "Host: {name}" },
        "join.calendarAria":   { ko: "소모임 일정", en: "Meetup schedule" },
        "join.dayPanelAria":   { ko: "선택한 날짜의 소모임", en: "Meetups on the selected day" },

        /* "?" quick-reference lightbox (join-manual.js) — static chrome only;
           the slide content itself (title/body/notes per screenshot) lives
           in join-manual.js's own SLIDES data as {ko, en} pairs, since it's
           a condensed rewrite of the full meetup-signup.html manual rather
           than a verbatim reuse of that page's copy. */
        "join.help.fabAria":   { ko: "소모임 신청 방법 안내", en: "How to sign up for a meetup" },
        "join.help.tabsAria":  { ko: "안내 섹션", en: "Guide sections" },
        "join.help.tabCreate": { ko: "새 소모임 만들기", en: "Create a New Meetup" },
        "join.help.tabJoin":   { ko: "소모임에 신청하기", en: "Sign Up for a Meetup" },
        "join.help.moreLink":  { ko: "전체 안내 페이지에서 자세히 보기 →", en: "See the full guide →" },
        "join.help.slideAria": { ko: "슬라이드 {n}", en: "Slide {n}" },

        /* create modal */
        "join.modal.createTitle":   { ko: "새 소모임 만들기", en: "Create a meetup" },
        "join.field.name":          { ko: "소모임 이름 *", en: "Meetup name *" },
        "join.field.namePh":        { ko: "예: 저녁 다과회", en: "e.g. Evening tea gathering" },
        "join.field.time":          { ko: "시간 *", en: "Time *" },
        "join.field.timeNone":      { ko: "선택 안 함", en: "Not set" },
        "join.field.hourAria":      { ko: "시", en: "Hour" },
        "join.field.minuteAria":    { ko: "분", en: "Minute" },
        "join.field.capacity":      { ko: "정원 (본인 포함) *", en: "Capacity (including you) *" },
        "join.field.location":      { ko: "장소", en: "Location" },
        "join.field.locationPh":    { ko: "예: 서울대입구역 근처에서 같이 정해봐요!",
                                      en: "e.g. Let's pick a place near Seoul Nat'l Univ. Stn. together!" },
        "join.field.mapLink":       { ko: "지도 링크 (선택)", en: "Map link (optional)" },
        "join.field.mapLinkPh":     { ko: "네이버 지도 공유 링크를 붙여넣으면 그 링크가 바로 열려요",
                                      en: "Paste a Naver Maps share link and it will open directly" },
        "join.field.host":          { ko: "주최자 이름 *", en: "Host name *" },
        "join.field.hostPh":        { ko: "닉네임도 좋아요", en: "A nickname is fine" },
        "join.field.hostRealName":  { ko: "주최자 실명 *", en: "Host's real name *" },
        "join.field.hostRealNamePh":{ ko: "관리자 확인용, 공개되지 않아요", en: "For admin verification only; never shown publicly" },
        "join.field.password":      { ko: "비밀번호 *", en: "Password *" },
        "join.field.passwordPh":    { ko: "나중에 수정/삭제할 때 필요해요", en: "Needed to edit or delete this later" },
        "join.field.desc":          { ko: "소개", en: "Description" },
        "join.field.descPh":        { ko: "어떤 자리인지 간단히 소개해주세요", en: "Briefly describe the gathering" },
        "join.btn.cancel":          { ko: "취소", en: "Cancel" },
        "join.btn.create":          { ko: "만들기", en: "Create" },
        "join.modal.editTitle":     { ko: "소모임 수정하기", en: "Edit meetup" },
        "join.btn.save":            { ko: "수정하기", en: "Save changes" },

        /* detail modal + day panel */
        "join.meta.when":      { ko: "일시", en: "When" },
        "join.meta.where":     { ko: "장소", en: "Where" },
        "join.meta.host":      { ko: "주최자", en: "Host" },
        "join.meta.capacity":  { ko: "정원", en: "Capacity" },
        "join.unlimited":      { ko: "무제한", en: "Unlimited" },
        "join.people":         { ko: "{n}명", en: "{n} people" },
        "join.mapView":        { ko: "지도에서 보기", en: "View on map" },
        "join.share":          { ko: "공유하기", en: "Share" },
        "join.shareDefault":   { ko: "소모임에 초대합니다!", en: "You're invited to a meetup!" },
        "join.share.when":     { ko: "🗓 일시 : {v}", en: "🗓 When : {v}" },
        "join.share.where":    { ko: "🚡 장소 : {v}", en: "🚡 Where : {v}" },
        "join.share.host":     { ko: "🙋 주최 : {v}", en: "🙋 Host : {v}" },
        "join.share.how":      { ko: "✅️ 신청 방법 : 아래 링크를 통해 신청", en: "✅️ To sign up : use the link below" },
        "join.copyPrompt":     { ko: "아래 내용을 복사해주세요:", en: "Please copy the text below:" },
        "join.createHint":     { ko: "내일 이후 날짜를 선택해야 소모임을 만들 수 있어요.",
                                 en: "Meetups can only be created for tomorrow onwards." },
        "join.dayEmptyFirst":  { ko: "이 날짜에는 아직 소모임이 없어요. 첫 소모임을 만들어보세요!",
                                 en: "No meetups on this day yet — be the first to create one!" },
        "join.dayEmpty":       { ko: "이 날짜에는 소모임이 없어요.", en: "No meetups on this day." },
        "join.participants":   { ko: "참가자 ({v})", en: "Participants ({v})" },
        "join.noParticipants": { ko: "아직 신청자가 없어요.", en: "No one has signed up yet." },
        "join.hostSuffix":     { ko: "{name} (주최자)", en: "{name} (host)" },
        "join.signedUpAs":     { ko: "✅ {name}님으로 신청 완료했어요.", en: "✅ You're signed up as {name}." },
        "join.cancelSignup":   { ko: "신청 취소하기", en: "Cancel my sign-up" },
        "join.cancelTooLate":  { ko: "행사 2일 전이라 신청 취소가 불가능해요.",
                                 en: "Sign-ups can't be cancelled within 2 days of the event." },
        "join.hostParticipating": { ko: "✅ 주최자로 참여 중이에요.", en: "✅ You're taking part as the host." },
        "join.eventEnded":     { ko: "행사가 종료되었어요.", en: "This event has ended." },
        "join.capacityFull":   { ko: "정원이 찼습니다.", en: "This meetup is full." },
        "join.signupClosedNote": { ko: "신청이 마감되었어요. (행사 24시간 전 마감)",
                                   en: "Sign-ups are closed (they close 24 hours before the event)." },

        /* signup form */
        "join.f.name":         { ko: "이름 *", en: "Name *" },
        "join.f.namePh":       { ko: "닉네임도 좋아요", en: "A nickname is fine" },
        "join.f.realName":     { ko: "실명 *", en: "Real name *" },
        "join.f.realNamePh":   { ko: "관리자 확인용, 공개되지 않아요", en: "For admin verification only; never shown publicly" },
        "join.f.contact":      { ko: "연락처 (선택)", en: "Contact (optional)" },
        "join.f.contactPh":    { ko: "카카오톡 ID / 전화번호 등 (주최자만 볼 수 있어요)",
                                 en: "KakaoTalk ID, phone number, etc. (only the host can see this)" },
        "join.f.cancelPw":     { ko: "취소 비밀번호 *", en: "Cancellation password *" },
        "join.f.cancelPwHint": { ko: "다른 기기에서 신청을 취소할 때 필요해요. 잊어버리지 않을 값으로 설정해주세요.",
                                 en: "Needed to cancel your sign-up from another device. Choose something you'll remember." },
        "join.f.cancelPwPh":   { ko: "비밀번호를 설정해주세요",
                                 en: "Set a cancellation password" },
        "join.f.submit":       { ko: "신청하기", en: "Sign up" },
        "join.f.otherDevice":  { ko: "다른 기기에서 신청하셨나요? 비밀번호로 취소하기",
                                 en: "Signed up on another device? Cancel with your password" },
        "join.f.realNamePh2":  { ko: "신청 시 입력한 실명", en: "The real name you signed up with" },
        "join.f.cancelPwReq":  { ko: "취소 비밀번호 *", en: "Cancellation password *" },
        "join.f.cancelPwPh2":  { ko: "신청 시 설정한 취소 비밀번호", en: "The cancellation password you set" },

        /* host controls */
        "join.h.edit":         { ko: "이 소모임 수정하기", en: "Edit this meetup" },
        "join.h.delete":       { ko: "이 소모임 삭제하기", en: "Delete this meetup" },
        "join.h.contacts":     { ko: "참가자 연락처 보기", en: "View participant contacts" },
        "join.h.hasOthers":    { ko: "다른 참가자가 있어 삭제할 수 없어요.",
                                 en: "Can't delete — other people have signed up." },
        "join.h.unlock":       { ko: "비밀번호로 관리 (수정/삭제)", en: "Manage with password (edit/delete)" },
        "join.h.promptPw":     { ko: "이 소모임을 만들 때 설정한 비밀번호를 입력해주세요.",
                                 en: "Enter the password you set when creating this meetup." },
        "join.h.confirmDelete":{ ko: "이 소모임을 삭제할까요? 되돌릴 수 없어요.",
                                 en: "Delete this meetup? This can't be undone." },
        "join.h.contactsTitle":{ ko: "참가자 연락처 (주최자 전용)", en: "Participant contacts (host only)" },
        "join.h.canceledSuffix": { ko: " (취소)", en: " (cancelled)" },
        "join.h.realNamePrefix": { ko: "실명: {v}", en: "Real name: {v}" },
        "join.h.noRealName":   { ko: "실명 미입력", en: "No real name given" },
        "join.h.noContact":    { ko: "연락처 미입력", en: "No contact given" },

        /* errors (also produced by the demo-mode backend) */
        "join.err.required":       { ko: "제목, 날짜, 주최자 이름은 필수예요.", en: "Title, date and host name are required." },
        "join.err.capacityMin":    { ko: "정원은 3 이상의 숫자여야 해요 (본인 포함).", en: "Capacity must be at least 3 (including you)." },
        "join.err.notApproved":    { ko: "아직 관리자 승인 대기 중인 소모임이에요.", en: "This meetup is still awaiting admin approval." },
        "join.pendingApproval":    { ko: "관리자 승인 대기 중", en: "Pending admin approval" },
        "join.pendingApprovalDesc":{ ko: "이 소모임은 관리자의 승인이 완료된 후부터 신청받을 수 있어요.", en: "Sign-ups open once an admin approves this meetup." },
        "join.err.capacityBelow":  { ko: "이미 {n}명이 참가 중이라 정원을 그보다 줄일 수 없어요.",
                                     en: "{n} people have already joined, so capacity can't go below that." },
        "join.err.needPassword":   { ko: "비밀번호를 설정해주세요. 나중에 수정/삭제할 때 필요해요.",
                                     en: "Please set a password — you'll need it to edit or delete this later." },
        "join.err.needHostRealName": { ko: "주최자 실명을 입력해주세요.", en: "Please enter the host's real name." },
        "join.err.noEvent":        { ko: "존재하지 않는 소모임이에요.", en: "That meetup doesn't exist." },
        "join.err.noEditPerm":     { ko: "수정 권한이 없어요. 비밀번호를 확인해주세요.", en: "You can't edit this. Please check the password." },
        "join.err.noDeletePerm":   { ko: "삭제 권한이 없어요. 비밀번호를 확인해주세요.", en: "You can't delete this. Please check the password." },
        "join.err.hasOthers":      { ko: "다른 참가자가 있어 삭제할 수 없어요.", en: "Can't delete — other people have signed up." },
        "join.err.signupClosed":   { ko: "신청이 마감되었어요. (행사 24시간 전 마감)",
                                     en: "Sign-ups are closed (they close 24 hours before the event)." },
        "join.err.needName":       { ko: "이름을 입력해주세요.", en: "Please enter your name." },
        "join.err.needRealName":   { ko: "실명을 입력해주세요.", en: "Please enter your real name." },
        "join.err.needTime":       { ko: "시간을 선택해주세요.", en: "Please pick a time." },
        "join.err.needCancelPw":   { ko: "취소 비밀번호를 설정해주세요.", en: "Please set a cancellation password." },
        "join.err.full":           { ko: "정원이 찼어요.", en: "This meetup is full." },
        "join.err.dupName":        { ko: "이미 같은 이름으로 신청되어 있어요.", en: "Someone has already signed up with that name." },
        "join.err.noSignup":       { ko: "존재하지 않는 신청이에요.", en: "That sign-up doesn't exist." },
        "join.err.noCancelPerm":   { ko: "취소 권한이 없어요.", en: "You don't have permission to cancel this." },
        "join.err.alreadyCanceled":{ ko: "이미 취소된 신청이에요.", en: "That sign-up was already cancelled." },
        "join.err.tooLateCancel":  { ko: "행사 2일 전부터는 신청을 취소할 수 없어요.",
                                     en: "Sign-ups can't be cancelled within 2 days of the event." },
        "join.err.badCancelCreds": { ko: "실명 또는 취소 비밀번호가 올바르지 않아요.",
                                     en: "The real name or cancellation password is incorrect." },
        "join.err.noPerm":         { ko: "권한이 없어요. 비밀번호를 확인해주세요.", en: "Not permitted. Please check the password." },
        "join.err.badAdminPw":     { ko: "관리자 비밀번호가 올바르지 않습니다.", en: "The admin password is incorrect." },
        "join.err.saveFailed":     { ko: "저장하지 못했어요. 다시 시도해주세요.", en: "Couldn't save. Please try again." },
        "join.err.network":        { ko: "네트워크 오류가 발생했어요. 다시 시도해주세요.", en: "A network error occurred. Please try again." },
        "join.err.networkShort":   { ko: "네트워크 오류가 발생했어요.", en: "A network error occurred." },
        "join.err.signupFailed":   { ko: "신청하지 못했어요. 다시 시도해주세요.", en: "Couldn't sign up. Please try again." },
        "join.err.cancelFailed":   { ko: "취소하지 못했어요.", en: "Couldn't cancel." },
        "join.err.deleteFailed":   { ko: "삭제하지 못했어요.", en: "Couldn't delete." },
        "join.err.contactsFailed": { ko: "참가자 목록을 불러오지 못했어요.", en: "Couldn't load the participant list." },

        /* time <select> options */
        "join.hourOpt":            { ko: "{h}시", en: "{h}:00" },
        "join.minuteOpt":          { ko: "{m}분", en: ":{m}" },
        "join.minuteOptExisting":  { ko: "{m}분 (기존)", en: ":{m} (existing)" }
    };

    /* ── dates ────────────────────────────────────────────────────
       Kept as helpers rather than dictionary keys so callers can format
       any date without a key per value. */
    var MONTHS_EN = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];
    var MONTHS_EN_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var WEEKDAYS = {
        ko: ["일", "월", "화", "수", "목", "금", "토"],
        en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    };

    /* m is 1-based */
    function formatDate(y, m, d) {
        return lang === "en"
            ? MONTHS_EN[m - 1] + " " + d + ", " + y
            : y + "년 " + m + "월 " + d + "일";
    }
    function formatMonthLabel(y, m) {
        return lang === "en" ? MONTHS_EN[m - 1] + " " + y : y + "년 " + m + "월";
    }
    /* full date including weekday, e.g. "2026년 8월 17일 (월)" / "August 17, 2026 (Mon)" */
    function formatDateWithWeekday(y, m, d) {
        var wd = WEEKDAYS[lang][new Date(y, m - 1, d).getDay()];
        return formatDate(y, m, d) + " (" + wd + ")";
    }
    /* short form with weekday, e.g. "8월 17일 (월)" / "Aug 17 (Mon)" */
    function formatDayShort(y, m, d) {
        var wd = WEEKDAYS[lang][new Date(y, m - 1, d).getDay()];
        return lang === "en"
            ? MONTHS_EN_SHORT[m - 1] + " " + d + " (" + wd + ")"
            : m + "월 " + d + "일 (" + wd + ")";
    }
    function formatTime(h, min) {
        if (lang === "en") {
            var ap = h < 12 ? "AM" : "PM";
            var hh = h % 12 === 0 ? 12 : h % 12;
            return hh + ":" + String(min).padStart(2, "0") + " " + ap;
        }
        var period = h < 12 ? "오전" : "오후";
        var kh = h % 12 === 0 ? 12 : h % 12;
        return period + " " + kh + "시" + (min ? " " + min + "분" : "");
    }
    function weekdays() { return WEEKDAYS[lang].slice(); }

    /* ── language state ───────────────────────────────────────────── */
    function stored() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    var lang = stored() === "en" ? "en" : DEFAULT_LANG;

    function t(key, vars) {
        var entry = DICT[key];
        if (!entry) return "";
        /* fall back to Korean whenever the English string is missing or blank */
        var s = (lang === "en" && entry.en) ? entry.en : entry.ko;
        if (vars) {
            s = s.replace(/\{(\w+)\}/g, function (m, name) {
                return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m;
            });
        }
        return s;
    }

    /* ── DOM application ──────────────────────────────────────────── */
    function apply(root) {
        var scope = root || document;

        /* optional "n:8|d:강남구" companion attribute for {placeholder} values */
        function varsOf(el) {
            var raw = el.getAttribute("data-i18n-vars");
            if (!raw) return null;
            var out = {};
            raw.split("|").forEach(function (pair) {
                var i = pair.indexOf(":");
                if (i > 0) out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
            });
            return out;
        }

        scope.querySelectorAll("[data-i18n]").forEach(function (el) {
            var v = t(el.getAttribute("data-i18n"), varsOf(el));
            if (v !== "") el.textContent = v;
        });

        scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
            var v = t(el.getAttribute("data-i18n-html"));
            if (v !== "") el.innerHTML = v;
        });

        scope.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
            el.getAttribute("data-i18n-attr").split("|").forEach(function (pair) {
                var i = pair.indexOf(":");
                if (i < 0) return;
                var attr = pair.slice(0, i).trim();
                var v = t(pair.slice(i + 1).trim());
                if (v !== "") el.setAttribute(attr, v);
            });
        });

        document.documentElement.setAttribute("lang", lang);
    }

    function setLang(next) {
        lang = next === "en" ? "en" : "ko";
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode */ }
        apply();
        syncToggle();
        maybeAutoShowDisclaimer();
        window.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: lang } }));
    }

    /* ── toggle button, injected into each page's existing header ─── */
    function syncToggle() {
        var btn = document.getElementById("langToggle");
        if (!btn) return;
        btn.querySelectorAll(".lang_opt").forEach(function (o) {
            o.classList.toggle("is-active", o.dataset.lang === lang);
        });
        btn.setAttribute("aria-label",
            lang === "ko" ? "Switch to English" : "한국어로 전환");

        /* disclaimer only ever makes sense while reading the English
           translation — hide the "?" affordance (and close its popover,
           if open) the moment we're back in Korean */
        var dBtn = document.getElementById("langDisclaimerBtn");
        if (dBtn) dBtn.hidden = lang !== "en";
        if (lang !== "en") closeDisclaimer();
    }

    /* ── translation disclaimer popover ──────────────────────────────
       A small "i" button next to the toggle, visible only in English.
       Clicking it opens a short amber callout (same visual language as
       .ot_rule / .man_note) explaining that the Korean text governs.
       Auto-opens once, the very first time a visitor lands on the site
       in English — tracked separately from STORAGE_KEY so re-toggling
       languages later doesn't re-trigger it. */
    var DISCLAIMER_SEEN_KEY = "snuTeaEnDisclaimerSeen_v1";

    function openDisclaimer() {
        var pop = document.getElementById("langDisclaimerPopover");
        var btn = document.getElementById("langDisclaimerBtn");
        if (!pop || !btn) return;
        pop.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        try { localStorage.setItem(DISCLAIMER_SEEN_KEY, "1"); } catch (e) { /* private mode */ }
    }
    function closeDisclaimer() {
        var pop = document.getElementById("langDisclaimerPopover");
        var btn = document.getElementById("langDisclaimerBtn");
        if (pop) pop.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
    }
    function disclaimerSeen() {
        try { return localStorage.getItem(DISCLAIMER_SEEN_KEY) === "1"; } catch (e) { return false; }
    }
    function maybeAutoShowDisclaimer() {
        if (lang === "en" && !disclaimerSeen()) openDisclaimer();
    }

    function injectToggle() {
        var host = document.querySelector(".header .header_inner");
        if (!host || document.getElementById("langToggle")) return;

        /* wrapper carries the positioning that used to live directly on
           .lang_toggle, so the disclaimer button/popover can sit right
           next to it and the popover can anchor off the wrapper (top:100%)
           instead of a hardcoded pixel offset that would need to vary
           per page template's header height */
        var wrap = document.createElement("div");
        wrap.className = "lang_toggle_wrap";

        var btn = document.createElement("button");
        btn.type = "button";
        btn.id = "langToggle";
        btn.className = "lang_toggle";
        btn.innerHTML =
            '<span class="lang_opt" data-lang="ko">KOR</span>'
            + '<span class="lang_opt" data-lang="en">ENG</span>';
        btn.addEventListener("click", function () {
            setLang(lang === "ko" ? "en" : "ko");
        });

        var dBtn = document.createElement("button");
        dBtn.type = "button";
        dBtn.id = "langDisclaimerBtn";
        dBtn.className = "lang_disclaimer_btn";
        dBtn.textContent = "i";
        dBtn.setAttribute("data-i18n-attr", "aria-label:lang.disclaimer.btnAria");
        dBtn.setAttribute("aria-haspopup", "true");
        dBtn.setAttribute("aria-expanded", "false");
        dBtn.hidden = true;
        dBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var pop = document.getElementById("langDisclaimerPopover");
            if (pop && !pop.hidden) closeDisclaimer();
            else openDisclaimer();
        });

        var pop = document.createElement("div");
        pop.id = "langDisclaimerPopover";
        pop.className = "lang_disclaimer_popover";
        pop.hidden = true;
        pop.innerHTML =
            '<button type="button" class="lang_disclaimer_close" aria-label="Close">&times;</button>'
            + '<p class="lang_disclaimer_popover_title" data-i18n="lang.disclaimer.title">About this translation</p>'
            + '<p data-i18n="lang.disclaimer.body"></p>';
        pop.addEventListener("click", function (e) { e.stopPropagation(); });
        pop.querySelector(".lang_disclaimer_close").addEventListener("click", closeDisclaimer);

        wrap.appendChild(btn);
        wrap.appendChild(dBtn);
        wrap.appendChild(pop);
        host.appendChild(wrap);

        /* dismiss on outside click / Escape, same as any lightweight popover */
        document.addEventListener("click", function (e) {
            if (!pop.hidden && !wrap.contains(e.target)) closeDisclaimer();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !pop.hidden) closeDisclaimer();
        });

        syncToggle();
    }

    function init() {
        injectToggle();
        apply();
        maybeAutoShowDisclaimer();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.I18N = {
        t: t,
        apply: apply,
        setLang: setLang,
        formatDate: formatDate,
        formatMonthLabel: formatMonthLabel,
        formatDayShort: formatDayShort,
        formatDateWithWeekday: formatDateWithWeekday,
        formatTime: formatTime,
        weekdays: weekdays,
        /* picks entry.titleEn (or any *En field) when running in English,
           falling back to the Korean value — used for data-file content */
        pick: function (obj, field) {
            if (!obj) return "";
            var en = obj[field + "En"];
            return (lang === "en" && en) ? en : (obj[field] || "");
        },
        get lang() { return lang; }
    };
})();
