// Tea club event list — single source of truth, consumed by:
//  - events/calendar.js (renders the Events page calendar)
//  - events/events-nav.js (builds the event list in every subpage's sidebar)
//  - events/events-meta.js (renders the date/location/facilitator/fee/category
//    card on each event subpage, and shows the tea-lineup section when the
//    event's category is "regulars")
// Dates below are placeholders — replace with real dates as events are scheduled.
// `path` is relative to motherPage/ (no leading slash); every page that
// consumes it is exactly one folder below motherPage/, so callers all
// prefix it with "../".
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

const teaClubEvents = [
    {
        date: "2026-06-13",
        title: "26-1 종강다회",
        subtitle: "한 학기의 끝을 마무리하는 시간",
        path: "2026springEOS/26springEOS_index.html",
        location: "[장소를 입력해주세요]",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "regulars"
    },
    {
        date: "2026-09-05",
        title: "26-2 개강다회",
        subtitle: "새 학기를 여는 첫 만남",
        path: "2026summerSOS/26summerSOS_index.html",
        location: "[장소를 입력해주세요]",
        facilitator: "[진행자를 입력해주세요]",
        fee: "[참가비를 입력해주세요]",
        category: "regulars"
    }
];
