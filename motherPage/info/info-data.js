// 정보 게시글 목록 — info/index.html 목록과 메인 페이지 정보 캐러셀의
// 단일 소스. notices-data.js와 동일한 구조:
//   title  — 글 제목
//   date   — 작성/수정일 (YYYY-MM-DD)
//   path   — 상세 페이지 경로 (motherPage/ 기준, 앞에 슬래시 없음)
//             페이지가 준비되면 경로를 입력하고 info/index.html 목록에서
//             화살표 링크로 표시됨.
//   pinned — true면 목록 상단 고정 (녹색 '고정' 배지 표시)
const teaClubInfo = [
    // 예시:
    // { title: "글 제목", date: "2026-08-16", path: "info/article.html", pinned: false },
    { title: "찻집 정보", date: "2026-08-16", path: "join/chatjip-info.html", pinned: false },
];
