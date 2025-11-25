# 무빙 프로젝트 문서

## 📋 문서 목차

1. [테스트 계정 가이드](./TEST_ACCOUNTS.md) - 테스트 계정 정보 및 사용법
2. [API 명세서](./API_SPEC.md) - 백엔드 API 엔드포인트 상세 명세

---

## 🚀 빠른 시작

### 테스트 계정으로 로그인하기

프로젝트에 처음 접속하면 테스트 계정 정보 모달이 자동으로 표시됩니다.

**고객 계정 예시:**

- 이메일: `customer1@test.com`
- 비밀번호: `1q2w3e4r!`

**기사 계정 예시:**

- 이메일: `driver1@test.com`
- 비밀번호: `1q2w3e4r!`

더 많은 테스트 계정 정보는 [테스트 계정 가이드](./TEST_ACCOUNTS.md)를 참고하세요.

---

## 📚 문서 설명

### TEST_ACCOUNTS.md

- 모든 테스트 계정 정보 (고객/기사)
- 시드 데이터 실행 방법
- 생성되는 테스트 데이터 상세 정보
- 주요 기능 테스트 시나리오

### API_SPEC.md

- 백엔드 API 엔드포인트 전체 목록
- 요청/응답 형식
- 인증 방식
- 에러 처리

---

## 💡 사용 팁

### 테스트 계정 모달 다시 보기

브라우저 개발자 도구 콘솔에서:

```javascript
localStorage.removeItem("test_account_modal_shown");
location.reload();
```

### 시드 데이터 재생성

```bash
cd be
npm run seed   # testSeed.ts 실행
npm run seed2  # seed2.ts 실행
```

---

## 🔗 관련 링크

- [프론트엔드 저장소](https://github.com/sebiny/6-moving-team2-FE)
- [백엔드 저장소](https://github.com/danikim8/moving-dani-be)
- [프로젝트 노션](https://hungry-plate-76c.notion.site/217fff3108c98098bd43fdc393e922a1)
