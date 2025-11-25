# API 명세서

## 📋 목차

1. [인증 API](#인증-api)
2. [프로필 API](#프로필-api)
3. [기사 API](#기사-api)
4. [견적 요청 API](#견적-요청-api)
5. [고객 견적 API](#고객-견적-api)
6. [리뷰 API](#리뷰-api)
7. [주소 API](#주소-api)
8. [찜하기 API](#찜하기-api)
9. [알림 API](#알림-api)

---

## 🔐 인증 API

### 회원가입

```
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123!",
  "passwordConfirmation": "password123!",
  "name": "홍길동",
  "phone": "01012345678",
  "userType": "CUSTOMER" | "DRIVER"
}
```

### 로그인

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123!",
  "userType": "CUSTOMER" | "DRIVER"
}

Response:
{
  "accessToken": "jwt-token",
  "user": { ... }
}
```

### Google 소셜 로그인

```
GET /auth/social/google?userType=CUSTOMER
→ Google 인증 페이지로 리다이렉트
→ 콜백: /auth/social/google/callback
→ 성공 시 메인 페이지로 리다이렉트 (쿠키에 토큰 저장)
```

### 로그아웃

```
POST /auth/logout
Authorization: Bearer {accessToken}
```

### 현재 사용자 정보 조회

```
GET /auth/me
Authorization: Bearer {accessToken}

Response:
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "userType": "CUSTOMER",
    "name": "홍길동",
    "phone": "01012345678"
  }
}
```

### 액세스 토큰 재발급

```
POST /auth/refresh-token
Cookie: refreshToken={refreshToken}

Response:
{
  "accessToken": "new-jwt-token"
}
```

---

## 👤 프로필 API

### 고객 프로필 생성

```
POST /profile/customer
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "profileImage": "image-url",
  "moveType": ["HOME", "OFFICE", "SMALL"],
  "currentArea": "강남구"
}
```

### 기사 프로필 생성

```
POST /profile/driver
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "profileImage": "image-url",
  "nickname": "친절한기사",
  "career": 5,
  "shortIntro": "짧은 소개",
  "detailIntro": "상세 소개",
  "moveType": ["HOME", "OFFICE", "SMALL"],
  "serviceAreas": [
    { "region": "SEOUL", "district": "강남구" }
  ]
}
```

### 프로필 수정

```
PUT /profile/customer
PUT /profile/driver
Authorization: Bearer {accessToken}
```

### 프로필 이미지 업로드

```
POST /profile/image
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

file: {image-file}
```

---

## 🚗 기사 API

### 기사 목록 조회 (공개)

```
GET /drivers?page=1&keyword=강남&region=SEOUL&service=HOME&orderBy=work

Response:
{
  "data": [
    {
      "id": "driver-id",
      "nickname": "친절한기사",
      "career": 5,
      "averageRating": 4.5,
      "shortIntro": "소개",
      "moveType": ["HOME", "OFFICE"],
      "serviceAreas": [...]
    }
  ],
  "hasNext": true
}
```

### 기사 상세 조회 (공개)

```
GET /drivers/{driverId}

Response:
{
  "id": "driver-id",
  "nickname": "친절한기사",
  "career": 5,
  "averageRating": 4.5,
  "shortIntro": "소개",
  "detailIntro": "상세 소개",
  "moveType": ["HOME", "OFFICE"],
  "serviceAreas": [...],
  "reviews": [...]
}
```

### 기사 상세 조회 (인증 필요)

```
GET /drivers/{driverId}/auth
Authorization: Bearer {accessToken}
```

### 기사 리뷰 조회

```
GET /drivers/{driverId}/reviews?page=1
```

---

## 📝 견적 요청 API

### 견적 요청 생성

```
POST /customer/estimate-request
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "moveType": "HOME",
  "moveDate": "2025-12-01",
  "fromAddressId": "address-id",
  "toAddressId": "address-id",
  "designatedDriverIds": ["driver-id"] // 선택사항
}
```

### 견적 요청 목록 조회 (고객)

```
GET /customer/estimate-requests?status=PENDING&page=1
Authorization: Bearer {accessToken}
```

### 견적 요청 상세 조회 (고객)

```
GET /customer/estimate-requests/{requestId}
Authorization: Bearer {accessToken}
```

### 견적 요청 취소

```
DELETE /customer/estimate-requests/{requestId}
Authorization: Bearer {accessToken}
```

---

## 💰 고객 견적 API

### 내 견적 목록 조회

```
GET /customer/estimate?status=PENDING&page=1
Authorization: Bearer {accessToken}
```

### 견적 수락

```
POST /customer/estimate/{estimateId}/accept
Authorization: Bearer {accessToken}
```

### 견적 거절

```
POST /customer/estimate/{estimateId}/reject
Authorization: Bearer {accessToken}
```

---

## ⭐ 리뷰 API

### 리뷰 작성

```
POST /reviews
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "estimateRequestId": "request-id",
  "driverId": "driver-id",
  "rating": 5,
  "content": "리뷰 내용"
}
```

### 리뷰 수정

```
PUT /reviews/{reviewId}
Authorization: Bearer {accessToken}
```

### 리뷰 삭제

```
DELETE /reviews/{reviewId}
Authorization: Bearer {accessToken}
```

---

## 📍 주소 API

### 주소 등록

```
POST /address
Content-Type: application/json

{
  "postalCode": "12345",
  "street": "서울특별시 강남구 테헤란로 1길",
  "detail": "101호",
  "region": "SEOUL",
  "district": "강남구"
}
```

### 고객 주소 연결

```
POST /customer/address
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "addressId": "address-id",
  "role": "FROM" | "TO"
}
```

### 고객 주소 조회

```
GET /customer/address?role=FROM
Authorization: Bearer {accessToken}
```

---

## ❤️ 찜하기 API

### 찜하기 추가

```
POST /favorite
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "driverId": "driver-id"
}
```

### 찜하기 삭제

```
DELETE /favorite/{driverId}
Authorization: Bearer {accessToken}
```

### 찜하기 목록 조회

```
GET /favorite
Authorization: Bearer {accessToken}
```

---

## 🔔 알림 API

### 알림 목록 조회

```
GET /notification
Authorization: Bearer {accessToken}

Response:
{
  "data": [
    {
      "id": "notification-id",
      "type": "ESTIMATE_PROPOSED",
      "message": "새로운 견적이 제안되었습니다.",
      "isRead": false,
      "createdAt": "2025-11-25T..."
    }
  ],
  "hasNext": false
}
```

### 알림 읽음 처리

```
PUT /notification/{notificationId}/read
Authorization: Bearer {accessToken}
```

### 알림 전체 읽음 처리

```
PUT /notification/read-all
Authorization: Bearer {accessToken}
```

---

## 📌 공유 견적 API

### 견적 공유 링크 생성

```
POST /estimate/shared/{estimateId}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "sharedFrom": "CUSTOMER" | "DRIVER"
}

Response:
{
  "shareUrl": "https://moving-2.click/estimate/shared/{token}"
}
```

### 공유 견적 조회 (비회원 접근 가능)

```
GET /estimate/shared/{token}
```

---

## 🌐 번역 API

### 텍스트 번역

```
POST /translate
Content-Type: application/json

{
  "text": "번역할 텍스트",
  "targetLang": "ko" | "en" | "zh"
}

Response:
{
  "translated": "번역된 텍스트"
}
```

---

## 🔒 인증 방식

### Bearer Token 인증

대부분의 API는 `Authorization` 헤더에 Bearer 토큰을 포함해야 합니다:

```
Authorization: Bearer {accessToken}
```

### Cookie 인증

일부 API는 쿠키를 사용합니다:

- `accessToken`: 액세스 토큰 (httpOnly: false)
- `refreshToken`: 리프레시 토큰 (httpOnly: true)

---

## 📝 에러 응답 형식

```json
{
  "message": "에러 메시지",
  "statusCode": 400
}
```

### 주요 HTTP 상태 코드

- `200`: 성공
- `201`: 생성 성공
- `400`: 잘못된 요청
- `401`: 인증 필요
- `403`: 권한 없음
- `404`: 리소스 없음
- `422`: 유효성 검사 실패
- `500`: 서버 오류
