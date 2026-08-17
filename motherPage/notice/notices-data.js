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
// `excerpt` is the preview line shown on the main page cards (clamped to 3
// lines). `titleEn` / `excerptEn` are the English versions — either may be
// omitted, in which case the Korean value is shown in both languages.
//
// Ordering: pinned notices first (in array order), then the rest newest
// first — just keep this array in the order you want them shown.
const teaClubNotices = [
    {
        title: "신입부원 OT 자료",
        titleEn: "New Member Orientation",
        date: "2026-08-05",
        excerpt: "신입부원을 위한 오리엔테이션 자료를 모아두는 곳이에요. 동아리 소개와 활동 안내 자료가 곧 올라올 예정입니다.",
        excerptEn: "Where orientation material for new members lives. An introduction to the club and a guide to our activities are coming soon.",
        path: "notice/newmember-ot.html",
        pinned: true,
    },
    {
        title: "설다연 회칙",
        titleEn: "Seoldayeon Bylaws",
        date: "2026-08-05",
        excerpt: "동아리 운영의 기준이 되는 회칙 전문입니다. 총칙부터 부칙까지 여섯 개 장에 걸쳐 회원 자격, 임원진 구성, 재정과 징계 규정을 담고 있어요.",
        excerptEn: "The full club bylaws. Six chapters covering membership, the officer structure, finances and disciplinary rules, from the general provisions through to the addendum.",
        path: "notice/bylaws.html",
        pinned: true,
    },
];
