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
        "home.notice.title":   { ko: "공지사항/Q&A", en: "Notices & Q&A" },
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
        "notice.pageTitle":    { ko: "공지사항/Q&A", en: "Notices & Q&A" },
        "notice.title":        { ko: "공지사항/Q&A", en: "Notices & Q&A" },
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

        /* ── 회칙 / bylaws ────────────────────────────────────────────
           English intentionally left empty — the club will supply it.
           Until then these fall back to the Korean text. */
        "bylaws.pageTitle":    { ko: "회칙", en: "" },
        "bylaws.title":        { ko: "회칙", en: "" },
        "bylaws.pendingNote":  { ko: "", en: "An English version of the bylaws is not available yet. The Korean text below is authoritative." },

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
        "join.btn.create":          { ko: "만들기", en: "Create" }
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

        scope.querySelectorAll("[data-i18n]").forEach(function (el) {
            var v = t(el.getAttribute("data-i18n"));
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
            + '<span class="lang_sep" aria-hidden="true">/</span>'
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
