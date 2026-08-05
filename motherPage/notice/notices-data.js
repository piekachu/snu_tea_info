// 공지사항 (notice) list — single source of truth, consumed by:
//  - notice/notices.js on notice/index.html (renders the full list) and on
//    the main hub page (renders the "주요 공지" card row of pinned notices)
//
// `path` is relative to motherPage/ (no leading slash), same convention as
// events-data.js — each page prefixes it with how many folders below
// motherPage/ it sits (data-notice-prefix: "" on the main page, "../" on
// the notice list page).
//
// `pinned: true` marks an "important" notice: it sorts to the top of the
// list page (with a "고정" badge) and is what the main page previews.
//
// Ordering: pinned notices first (in array order), then the rest newest
// first — just keep this array in the order you want them shown.
const teaClubNotices = [
    {
        title: "신입부원 OT 자료",
        date: "2026-08-05",
        path: "notice/newmember-ot.html",
        pinned: true,
    },
    {
        title: "설다연 회칙 (1판, ver.3)",
        date: "2026-08-05",
        path: "notice/bylaws.html",
        pinned: true,
    },
];
