// 정보 게시글 목록 — info/index.html 목록과 메인 페이지 정보 캐러셀의
// 단일 소스. notices-data.js와 동일한 구조:
//   title     — 글 제목
//   titleEn   — (선택) 영문 제목. 없으면 영어 모드에서도 title을 씀
//   date      — 작성/수정일 (YYYY-MM-DD)
//   excerpt   — (선택) 메인 페이지 카드에 보이는 미리보기 문구.
//                카드에서 3줄까지 보이고 넘치면 말줄임 처리됨
//   excerptEn — (선택) 영문 미리보기 문구
//   path      — 상세 페이지 경로 (motherPage/ 기준, 앞에 슬래시 없음)
//                페이지가 준비되면 경로를 입력하고 info/index.html 목록에서
//                화살표 링크로 표시됨.
//   pinned    — true면 목록 상단 고정 (녹색 '고정' 배지 표시)
const teaClubInfo = [
    // 예시:
    // { title: "글 제목", date: "2026-08-16", excerpt: "미리보기 문구",
    //   path: "info/article.html", pinned: false },
    {
        title: "찻집 정보",
        titleEn: "Tea Houses",
        date: "2026-08-16",
        excerpt: "설다연 부원들이 직접 추천한 서울·경기권 찻집 61곳. 구별 지도와 목록으로 한눈에 살펴보고, 네이버 지도로 바로 길찾기까지 이어집니다.",
        excerptEn: "61 tea houses around Seoul and Gyeonggi, recommended by our members. Browse them by district on the map or as a list, with directions only a tap away.",
        path: "join/chatjip-info.html",
        pinned: false,
    },
    // 새 정보 글을 위한 자리표시자 항목 — info/untitled-1.html이 실제 내용으로
    // 채워지면 title/date/excerpt를 새 글 정보로 바꿔주세요.
    {
        title: "제목 미정",
        titleEn: "Untitled",
        date: "2026-08-17",
        excerpt: "곧 게시될 새 정보 글입니다. 내용이 준비되는 대로 업데이트할게요.",
        excerptEn: "A new info post — the details will be updated once the content is ready.",
        path: "info/untitled-1.html",
        pinned: false,
    },
];
