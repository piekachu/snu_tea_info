# 행사 페이지 생성 가이드

## 필수 속성

| 속성 | 설명 | 예시 |
|---|---|---|
| `date` | 행사 날짜 (YYYY-MM-DD) | `"2026-09-01"` |
| `title` | 행사 제목 | `"정기다회"` |
| `path` | 행사 페이지 HTML 경로 (`motherPage/` 기준) | `"2026septRegulars/index.html"` |
| `category` | 행사 유형 (아래 목록 참고) | `"regulars"` |

### category 값
| 값 | 표시 | 설명 |
|---|---|---|
| `teaClass` | 티클래스 | 차 우림법 등을 배우는 소규모 클래스 |
| `regulars` | 정기다회 | 개강/종강다회 등 정기 모임 (차 정보 섹션 표시됨) |
| `fieldTrip` | 다원답사 | 다원·티하우스 답사 |
| `special` | 특별행사 | 그 외 특별 행사 |
| `specialTea` | 특별다회 | 특별한 차로 진행하는 다회 (차 정보 섹션 표시됨) |

---

## 선택 속성

| 속성 | 설명 | 기본값 | 예시 |
|---|---|---|---|
| `signupStart` | 신청 오픈 날짜 (YYYY-MM-DD). 이 날짜 이전에는 **모집예정** 표시. | 미지정 시 즉시 오픈 | `"2026-08-15"` |
| `signupEnd` | 신청 마감 날짜 (YYYY-MM-DD). 이 날짜 이후에는 **마감** 표시. | 행사일 **3일 전** | `"2026-08-29"` |
| `time` | 시작 시간 | — | `"18:00"` |
| `endDate` | 다일 행사 종료 날짜 (YYYY-MM-DD) | — | `"2026-09-02"` |
| `location` | 장소 (주소 문자열 또는 네이버 지도 URL) | — | `"서울 관악구 관악로12길 11 2층 반조"` |
| `lat` / `lng` | 지도 핀 좌표 | — | `37.478222` / `126.953033` |
| `mapLink` | 네이버 지도 길찾기 URL | — | `"https://naver.me/xxxxxx"` |
| `fee` | 참가비 | — | `"10000원"` |
| `인원` | 정원 | 20 | `30` |
| `thumbnail` | 캐러셀 썸네일 이미지 경로 (`motherPage/` 기준) | — | `"2026septRegulars/hero.jpg"` |
| `subtitle` | 캐러셀 카드에 표시되는 한 줄 설명 | — | `"가을을 여는 첫 정기다회"` |

---

## 모집 상태 자동 계산

`status` 속성은 직접 설정하지 않습니다. 아래 규칙으로 자동 계산됩니다:

| 조건 | 표시 상태 | 신청하기 버튼 |
|---|---|---|
| 오늘 < `signupStart` | 모집예정 | 비활성 |
| `signupStart` ≤ 오늘 ≤ `signupEnd` | 모집중 | **활성** |
| 오늘 > `signupEnd` 또는 행사일이 지남 | 마감 | 비활성 |

- `signupStart` 미지정 시: 즉시 모집중 취급
- `signupEnd` 미지정 시: 행사일 3일 전까지 모집중

---

## 행사 페이지 폴더 구조

```
motherPage/
└── 2026septRegulars/
    ├── index.html   ← 행사 페이지 (아래 프롬프트로 생성)
    └── hero.jpg     ← 히어로 이미지 (선택)
```

---

## 행사 생성 요청 프롬프트

아래 형식으로 Claude에게 요청하면 `events-data.js` 항목 추가 + 행사 페이지 생성을 한 번에 처리합니다.

```
새 행사를 추가해줘.

Date: YYYY-MM-DD
Title: 행사 제목
Category: teaClass | regulars | fieldTrip | special | specialTea

--- 선택 ---
Signup start: YYYY-MM-DD   (모집 오픈 날짜; 미지정 시 즉시)
Signup end: YYYY-MM-DD     (신청 마감 날짜; 미지정 시 행사일 3일 전)
Time: HH:MM
End date: YYYY-MM-DD
Location: 주소 또는 네이버 지도 URL
lat / lng: 위도 / 경도
Map link: 네이버 지도 길찾기 URL
Fee: 참가비
Capacity: 정원
Hero image: 이미지 파일 경로 또는 첨부
Subtitle: 한 줄 설명
```

### 예시

```
새 행사를 추가해줘.

Date: 2026-09-15
Title: 9월 정기다회
Category: regulars
Time: 18:00
Location: 서울 관악구 관악로12길 11 2층 반조
lat / lng: 37.478222 / 126.953033
Map link: https://naver.me/xxxxxx
Fee: 10000원
Capacity: 40
Hero image: tea_image_pool/9901.png
```

---

## 참고

- `location`이 `http://` 또는 `https://`로 시작하면 지도에서 보기 링크로 자동 렌더링됩니다.
- `category`가 `regulars` 또는 `specialTea`이면 행사 페이지에 **차 정보 섹션**이 표시됩니다.
- 행사 날짜가 지나면 자동으로 **마감** 처리됩니다.
- `signupEnd`를 지정하지 않으면 행사일 **3일 전**이 마감일로 자동 적용됩니다.
- `신청하기` 버튼은 상태가 **모집중**일 때만 활성화됩니다.
