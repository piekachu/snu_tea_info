// Tea club event list — single source of truth, consumed by:
//  - events/calendar.js (renders the Events page calendar)
//  - events/events-carousel.js (renders the upcoming-events carousel on the
//    Events page)
//  - events/events-nav.js (builds the event list in every subpage's sidebar)
//  - events/events-meta.js (renders the date+time/location/fee/category
//    card on each event subpage, and shows the tea-lineup section when
//    the event's category has `showsTeaInfo: true`)
//  - events/events-map.js (renders an embedded Naver Map under the info card
//    when `lat`/`lng` are set — see below)
// `path` is relative to motherPage/ (no leading slash); every page that
// consumes it is exactly one folder below motherPage/, so callers all
// prefix it with "../".
//
// `endDate` is optional — set it for multi-day events (e.g. a temple stay
// spanning a weekend) and the calendar will show the event pill on every
// day in [date, endDate], and the info card will show the date as a range.
//
// `time` is optional — a plain string (e.g. "18:00") shown alongside the
// date in the info card's "일시" row (events-meta.js). Omit it for events
// where a start time isn't set yet.
//
// `thumbnail` is optional — a path relative to motherPage/ (same convention
// as `path`) to an image for the upcoming-events carousel. Omit it and the
// carousel shows a plain placeholder card instead of a broken image.
//
// `signupStart` is optional — the date on which sign-up opens (YYYY-MM-DD).
// Defaults to the event page creation date (i.e. immediately open) if omitted.
// Before this date the event shows as 모집예정.
//
// `signupEnd` is optional — the last date on which sign-up is accepted
// (YYYY-MM-DD). Defaults to 3 days before `date` if omitted.
// After this date the event shows as 마감.
//
// Status is computed automatically from signupStart/signupEnd — do NOT set
// it manually. effectiveEventStatus() returns:
//   recruiting — sign-up is open (between signupStart and signupEnd)
//   upcoming   — sign-up has not opened yet (before signupStart)
//   closed     — sign-up has ended, or the event date has passed
//
// `location` can be a plain address string, or a map link (e.g. a Naver Map
// share URL) — events-meta.js auto-detects http(s) URLs and renders those
// as a "지도에서 보기" link instead of plain text.
//
// `lat`/`lng` are optional — set both to drop a pin on an embedded map
// (events-map.js), centered on those coordinates. A venue's coordinates
// don't change, so look them up once (e.g. via a geocoder, or by long-
// pressing the spot in the Naver Map app for "좌표 복사") rather than
// geocoding `location` live in the browser — this needs only the "Web
// Dynamic Map" NCP product, not the separate "Geocoding" one.
//
// `mapLink` is optional — a Naver Map share URL (e.g. a naver.me short
// link) shown as a "길찾기" button under the embedded map, for full
// directions. Only meaningful alongside `lat`/`lng`.
//
// `인원` is the event's capacity (number of participants), shown in the info
// card right after 참가비. Defaults to 20 — update per event as needed.
//
// `category` must be one of the keys in eventCategories below:
//   teaClass    — 티클래스 (차 우림법 등을 배우는 소규모 클래스)
//   regulars    — 정기다회 (매 학기 종강/개강다회 등 정기 모임)
//   fieldTrip   — 다원답사 (다원/티하우스 답사)
//   special     — 특별행사 (그 외 특별 행사)
//   specialTea  — 특별다회 (특별히 준비된 차로 진행하는 다회; regulars처럼
//                 차 정보 섹션이 표시됨)
// `showsTeaInfo: true` on a category makes events-meta.js show the tea-info
// toggle and tea-lineup section (see #teaLineup) instead of just the plain
// event info panel.
const eventCategories = {
    teaClass: { label: "티클래스" },
    regulars: { label: "정기다회", showsTeaInfo: true },
    fieldTrip: { label: "다원답사" },
    special: { label: "특별행사" },
    specialTea: { label: "특별다회", showsTeaInfo: true }
};

// status labels — used by the carousel and meta card for display only;
// the actual status value is always computed by effectiveEventStatus()
const eventStatuses = {
    recruiting: { label: "모집중" },
    upcoming: { label: "모집예정" },
    closed: { label: "마감" }
};

const EVENT_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatEventDateKo(dateStr) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const weekday = EVENT_WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

function formatEventDateRangeKo(dateStr, endDateStr) {
    if (!endDateStr || endDateStr === dateStr) {
        return formatEventDateKo(dateStr);
    }
    const [year, month] = dateStr.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
    const endWeekday = EVENT_WEEKDAY_LABELS[new Date(endYear, endMonth - 1, endDay).getDay()];
    const start = formatEventDateKo(dateStr);
    // same year+month: shorten the end date to just "일 (요일)"
    if (year === endYear && month === endMonth) {
        return `${start} ~ ${endDay}일 (${endWeekday})`;
    }
    return `${start} ~ ${formatEventDateKo(endDateStr)}`;
}

// date (or date range) plus `time`, if set — used for the info card's
// "일시" row
function formatEventDateTimeKo(event) {
    const dateStr = formatEventDateRangeKo(event.date, event.endDate);
    return event.time ? `${dateStr} ${event.time}` : dateStr;
}

// true once an event's date (or endDate, for multi-day events) is over
function isPastEvent(event, referenceDate) {
    const now = referenceDate || new Date();
    const lastDay = new Date(`${event.endDate || event.date}T23:59:59`);
    return lastDay < now;
}

// returns the sign-up closing date; defaults to 3 days before event date
function getSignupEnd(event) {
    if (event.signupEnd) return event.signupEnd;
    const [y, m, d] = event.date.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    due.setDate(due.getDate() - 3);
    const pad = (n) => String(n).padStart(2, "0");
    return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
}

// computes status automatically from signupStart / signupEnd — never read
// event.status directly; always call this instead
//   closed     → event date has passed, OR signupEnd has passed
//   upcoming   → today is before signupStart
//   recruiting → sign-up is open
function effectiveEventStatus(event, referenceDate) {
    const now = referenceDate || new Date();
    if (isPastEvent(event, now)) return "closed";
    const end = getSignupEnd(event);
    if (new Date(`${end}T23:59:59`) < now) return "closed";
    const start = event.signupStart || null;
    if (start && new Date(`${start}T00:00:00`) > now) return "upcoming";
    return "recruiting";
}

const teaClubEvents = [
    {
        date: "2026-06-19",
        title: "26-1 종강다회",
        path: "2026springEOS/26springEOS_index.html",
        location: "https://naver.me/5pwsXu4f",
        fee: "[참가비를 입력해주세요]",
        인원: 20,
        category: "regulars"
    },
    {
        date: "2026-06-22",
        title: "26-2 개강다회",
        path: "2026summerSOS/26summerSOS_index.html",
        location: "https://naver.me/xoH83gzf",
        fee: "[참가비를 입력해주세요]",
        인원: 20,
        category: "regulars"
    },
    {
        date: "2026-07-10",
        title: "다과 만들기",
        path: "2026julyTeaSnacks/index.html",
        location: "[장소를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        인원: 20,
        category: "special"
    },
    {
        date: "2026-07-17",
        time: "18:00",
        title: "효월다회",
        path: "2026julyRegulars17/index.html",
        thumbnail: "2026julyRegulars17/9901.jpg",
        location: "서울 중구 삼일대로 363 지하1층 146호 (티앤커피토브)",
        lat: 37.5671779,
        lng: 126.9870535,
        mapLink: "https://naver.me/GlRObS6h",
        fee: "1만5천원 / 1인",
        인원: 20,
        category: "specialTea"
    },
    {
        date: "2026-07-25",
        endDate: "2026-07-26",
        title: "흥국사 템플스테이",
        path: "2026julyTempleStay/index.html",
        location: "[장소를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        인원: 20,
        category: "fieldTrip"
    },
    {
        date: "2026-07-28",
        title: "이도옥션",
        path: "2026julyYidoAuction/index.html",
        location: "[장소를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        인원: 20,
        category: "special"
    },
    {
        date: "2026-07-30",
        time: "19:00 - 21:00",
        title: "정기다회",
        path: "2026julyRegulars/index.html",
        thumbnail: "2026julyRegulars/9902.jpg",
        location: "반조(서울 관악구 관악로12길 11 2층)",
        lat: 37.478222,
        lng: 126.953033,
        mapLink: "https://map.naver.com/p/entry/place/1752983758?c=15.00,0,0,0,dh&isCorrectAnswer=true&placePath=%2Fhome%3Ffrom%3Dmap%26fromPanelNum%3D1%26additionalHeight%3D76%26timestamp%3D202607232140%26locale%3Dko%26svcName%3Dmap_pcv5",
        fee: "10000원",
        인원: 40,
        category: "regulars"
    },
    {
        date: "2026-09-01",
        time: "18:00",
        title: "test_event",
        path: "test_event/index.html",
        thumbnail: "test_event/hero.jpg",
        location: "서울 관악구 관악로12길 11 2층 반조",
        lat: 37.478252,
        lng: 126.953039,
        mapLink: "https://naver.me/xwmq9Wk5",
        fee: "10000원",
        인원: 30,
        category: "regulars"
    }
];
