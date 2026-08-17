// 소모임 정보 항목 — "정보" 탭에 표시되는 안내/FAQ 목록.
// 공지사항/FAQ 데이터(notices-data.js)와 같은 구조:
//   title   — 항목 제목
//   date    — 최종 수정 또는 작성일 (YYYY-MM-DD)
//   path    — 상세 페이지 경로 (motherPage/ 기준).
//             페이지가 없으면 null → 링크 없는 텍스트 행으로 표시됨.
//   pinned  — true면 목록 상단에 고정 (녹색 배지 표시)
const teaJoinInfo = [
    {
        title: "소모임 신청 방법",
        date: "2026-08-16",
        path: null,
        pinned: true
    },
    {
        title: "소모임 개설 안내",
        date: "2026-08-16",
        path: null,
        pinned: true
    },
    {
        title: "취소 및 환불 규정",
        date: "2026-08-16",
        path: null,
        pinned: false
    },
    {
        title: "자주 묻는 질문 (FAQ)",
        date: "2026-08-16",
        path: null,
        pinned: false
    },
    {
        title: "찻집 정보",
        date: "2026-08-16",
        path: "join/chatjip-info.html",
        pinned: false
    }
];
