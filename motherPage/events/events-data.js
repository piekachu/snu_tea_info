// Tea club event list — single source of truth, consumed by:
//  - events/calendar.js (renders the Events page calendar)
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
        status: "upcoming"
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
        status: "upcoming"
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
