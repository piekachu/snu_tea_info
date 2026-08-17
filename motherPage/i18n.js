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

        /* ── home ─────────────────────────────────────────────────── */
        "home.events.title":   { ko: "Events", en: "Events" },
        "home.events.intro":   { ko: "설다연에서 주최하는 정기 행사와 특별 프로그램들을 만나보세요. 차 시음회부터 문화 체험까지, 다양한 행사를 통해 함께 성장하고 즐거운 추억을 만들 수 있습니다.",
                                 en: "Discover the regular events and special programmes Seoldayeon hosts. From tea tastings to cultural experiences, there are plenty of ways to learn together and make good memories." },
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

        /* ── 찻집 정보 (venue names and addresses deliberately stay Korean so
              they keep matching the Naver Maps links) ─────────────── */
        "chatjip.pageTitle":   { ko: "찻집 정보 — 설다연", en: "Tea Houses — Seoldayeon" },
        "chatjip.title":       { ko: "찻집 정보", en: "Tea Houses" },
        "chatjip.badge":       { ko: "61곳", en: "61 places" },
        "chatjip.subtitle":    { ko: "설다연 부원들이 추천하는 서울·경기권 찻집 목록입니다. 네이버 지도 링크로 위치를 바로 확인할 수 있어요.",
                                 en: "Tea houses around Seoul and Gyeonggi recommended by Seoldayeon members. Each entry links straight to Naver Maps. Names and addresses are kept in Korean so the map links work." },
        "chatjip.tabMap":      { ko: "지도", en: "Map" },
        "chatjip.tabList":     { ko: "목록", en: "List" },
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

        /* ── 신입부원 OT ──────────────────────────────────────────── */
        "ot.pageTitle":        { ko: "신입부원 OT 자료 — 공지사항", en: "New Member Orientation — Notices" },
        "ot.title":            { ko: "신입부원 OT 자료", en: "New Member Orientation" },
        "ot.empty":            { ko: "아직 등록된 내용이 없습니다.", en: "Nothing has been posted yet." },

        /* ── 회칙 / bylaws ────────────────────────────────────────────
           English intentionally left empty — the club will supply it.
           Until then these fall back to the Korean text. */
        "bylaws.pageTitle":    { ko: "설다연 회칙 (1판, ver.3) — 공지사항", en: "" },
        "bylaws.title":        { ko: "설다연 회칙 (1판, ver.3)", en: "" },
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

        /* ── 소모임 / join ───────────────────────────────────────── */
        "join.pageTitle":      { ko: "소모임 신청", en: "Meetup Sign-up" },
        "join.title":          { ko: "소모임 신청", en: "Meetup Sign-up" },
        "join.intro":          { ko: "원하는 날짜를 골라 새로운 소모임을 열거나, 이미 열린 소모임에 참가 신청을 해보세요. 누구나 자유롭게 만들고 신청할 수 있어요.",
                                 en: "Pick a date to open a new meetup, or sign up for one that's already been created. Anyone is welcome to host or join." },
        "join.tabCalendar":    { ko: "소모임 신청", en: "Sign up" },
        "join.tabInfo":        { ko: "정보", en: "Info" },
        "join.infoIntro":      { ko: "소모임 신청에 관한 안내와 규칙을 확인하세요.",
                                 en: "Guidance and rules for signing up to meetups." },
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

        /* create modal */
        "join.modal.createTitle":   { ko: "새 소모임 만들기", en: "Create a meetup" },
        "join.field.name":          { ko: "소모임 이름 *", en: "Meetup name *" },
        "join.field.namePh":        { ko: "예: 저녁 다과회", en: "e.g. Evening tea gathering" },
        "join.field.time":          { ko: "시간", en: "Time" },
        "join.field.timeNone":      { ko: "선택 안 함", en: "Not set" },
        "join.field.hourAria":      { ko: "시", en: "Hour" },
        "join.field.minuteAria":    { ko: "분", en: "Minute" },
        "join.field.capacity":      { ko: "정원 (본인 포함) *", en: "Capacity (including you) *" },
        "join.field.location":      { ko: "장소", en: "Location" },
        "join.field.locationPh":    { ko: "예: 학생회관 3층 동아리방", en: "e.g. Student Union 3F club room" },
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
        "join.f.cancelPw":     { ko: "취소 비밀번호 (선택)", en: "Cancellation password (optional)" },
        "join.f.cancelPwHint": { ko: "다른 기기에서 신청을 취소할 때 필요해요.",
                                 en: "Needed to cancel your sign-up from another device." },
        "join.f.cancelPwPh":   { ko: "비밀번호를 설정하면 다른 기기에서도 취소 가능",
                                 en: "Set one to allow cancelling from another device" },
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
        "join.h.adminDelete":  { ko: "관리자 권한으로 삭제", en: "Delete as admin" },
        "join.h.promptPw":     { ko: "이 소모임을 만들 때 설정한 비밀번호를 입력해주세요.",
                                 en: "Enter the password you set when creating this meetup." },
        "join.h.promptAdminPw":{ ko: "관리자 비밀번호를 입력해주세요.", en: "Enter the admin password." },
        "join.h.confirmDelete":{ ko: "이 소모임을 삭제할까요? 되돌릴 수 없어요.",
                                 en: "Delete this meetup? This can't be undone." },
        "join.h.contactsTitle":{ ko: "참가자 연락처 (주최자 전용)", en: "Participant contacts (host only)" },
        "join.h.canceledSuffix": { ko: " (취소)", en: " (cancelled)" },
        "join.h.realNamePrefix": { ko: "실명: {v}", en: "Real name: {v}" },
        "join.h.noRealName":   { ko: "실명 미입력", en: "No real name given" },
        "join.h.noContact":    { ko: "연락처 미입력", en: "No contact given" },

        /* errors (also produced by the demo-mode backend) */
        "join.err.required":       { ko: "제목, 날짜, 주최자 이름은 필수예요.", en: "Title, date and host name are required." },
        "join.err.capacityMin":    { ko: "정원은 1 이상의 숫자여야 해요 (본인 포함).", en: "Capacity must be at least 1 (including you)." },
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
    }

    function injectToggle() {
        var host = document.querySelector(".header .header_inner");
        if (!host || document.getElementById("langToggle")) return;
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
        host.appendChild(btn);
        syncToggle();
    }

    function init() {
        injectToggle();
        apply();
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
