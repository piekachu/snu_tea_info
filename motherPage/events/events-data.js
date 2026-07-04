// Tea club event list — single source of truth, consumed by:
//  - events/calendar.js (renders the Events page calendar)
//  - events/events-carousel.js (renders the upcoming-events carousel on the
//    Events page)
//  - events/events-nav.js (builds the event list in every subpage's sidebar)
//  - events/events-meta.js (renders the date/location/facilitator/fee/category
//    card on each event subpage, and shows the tea-lineup section when the
//    event's category is "regulars")
// `path` is relative to motherPage/ (no leading slash); every page that
// consumes it is exactly one folder below motherPage/, so callers all
// prefix it with "../".
//
// `endDate` is optional — set it for multi-day events (e.g. a temple stay
// spanning a weekend) and the calendar will show the event pill on every
// day in [date, endDate], and the info card will show the date as a range.
//
// `thumbnail` is optional — a path relative to motherPage/ (same convention
// as `path`) to an image for the upcoming-events carousel. Omit it and the
// carousel shows a plain placeholder card instead of a broken image.
//
// `location` can be a plain address string, or a map link (e.g. a Naver Map
// share URL) — events-meta.js auto-detects http(s) URLs and renders those
// as a "지도에서 보기" link instead of plain text.
//
// `category` must be one of the keys in eventCategories below:
//   teaClass  — 티클래스 (차 우림법 등을 배우는 소규모 클래스)
//   regulars  — 정기다회 (매 학기 종강/개강다회 등 정기 모임)
//   fieldTrip — 다원답사 (다원/티하우스 답사)
//   special   — 특별행사 (그 외 특별 행사)
const eventCategories = {
    teaClass: { label: "티클래스" },
    regulars: { label: "정기다회" },
    fieldTrip: { label: "다원답사" },
    special: { label: "특별행사" }
};

// `status` must be one of the keys in eventStatuses below:
//   recruiting — 모집중 (참가 신청을 받고 있음)
//   upcoming   — 모집예정 (아직 신청이 열리지 않음)
//   closed     — 마감 (신청이 종료됨)
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

// true once an event's date (or endDate, for multi-day events) is over
function isPastEvent(event, referenceDate) {
    const now = referenceDate || new Date();
    const lastDay = new Date(`${event.endDate || event.date}T23:59:59`);
    return lastDay < now;
}

// an event whose date (or endDate, for multi-day events) has already
// passed is always "closed", regardless of what status is set on it —
// consumers should call this instead of reading event.status directly
function effectiveEventStatus(event, referenceDate) {
    return isPastEvent(event, referenceDate) ? "closed" : event.status;
}

const teaClubEvents = [
    {
        date: "2026-06-19",
        title: "26-1 종강다회",
        subtitle: "한 학기의 끝을 마무리하는 시간",
        path: "2026springEOS/26springEOS_index.html",
        location: "https://naver.me/5pwsXu4f",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "regulars",
        status: "closed"
    },
    {
        date: "2026-06-22",
        title: "26-2 개강다회",
        subtitle: "새 학기를 여는 첫 만남",
        path: "2026summerSOS/26summerSOS_index.html",
        location: "https://naver.me/xoH83gzf",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "regulars",
        status: "closed"
    },
    {
        date: "2026-07-10",
        title: "다과 만들기",
        subtitle: "차와 함께할 다과를 직접 만들어보는 시간",
        path: "2026julyTeaSnacks/index.html",
        location: "[장소를 입력해주세요]",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "special",
        status: "upcoming"
    },
    {
        date: "2026-07-25",
        endDate: "2026-07-26",
        title: "흥국사 템플스테이",
        subtitle: "산사에서 보내는 하룻밤",
        path: "2026julyTempleStay/index.html",
        location: "[장소를 입력해주세요]",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "fieldTrip",
        status: "upcoming"
    },
    {
        date: "2026-07-28",
        title: "이도옥션",
        subtitle: "[한 줄 소개 문구를 입력해주세요]",
        path: "2026julyYidoAuction/index.html",
        location: "[장소를 입력해주세요]",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "special",
        status: "upcoming"
    },
    {
        date: "2026-07-31",
        title: "정기다회",
        subtitle: "[한 줄 소개 문구를 입력해주세요]",
        path: "2026julyRegulars/index.html",
        location: "[장소를 입력해주세요]",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "regulars",
        status: "upcoming"
    },
    {
        date: "2026-08-09",
        title: "운영진 티클래스",
        subtitle: "운영진이 함께하는 차 공부 시간",
        path: "2026augStaffTeaClass/index.html",
        location: "[장소를 입력해주세요]",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "teaClass",
        status: "upcoming"
    }
];
