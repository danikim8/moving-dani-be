export const getCookieDomain = (): string | undefined => {
  const clientUrl = process.env.CLIENT_URL ?? "";

  // 로컬 개발 환경이면 domain 생략
  if (clientUrl.includes("localhost")) {
    return undefined;
  }

  // Vercel 도메인인 경우 쿠키 도메인 설정하지 않음 (서브도메인이 다를 수 있음)
  if (clientUrl.includes("vercel.app")) {
    return undefined;
  }

  // 커스텀 도메인인 경우 .도메인 형식
  if (clientUrl.includes("moving-2.click")) {
    return ".moving-2.click";
  }

  // 기본적으로 도메인 설정하지 않음 (같은 도메인에서만 쿠키 사용)
  return undefined;
};
