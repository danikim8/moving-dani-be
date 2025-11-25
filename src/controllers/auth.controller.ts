import { Request, Response, NextFunction } from "express";
import authService, { TokenUserPayload } from "../services/auth.service";
import authRepository from "../repositories/auth.repository";
import passport from "../config/passport";
import { asyncHandler } from "../utils/asyncHandler";
import { UserType } from "@prisma/client";
import { CustomError } from "../utils/customError";
import { getCookieDomain } from "../utils/getCookieDomain";

declare global {
  namespace Express {
    interface User extends TokenUserPayload {}
  }
}

// 회원가입
const signUp = asyncHandler(async (req: Request, res: Response) => {
  const { userType, name, email, phone, password, passwordConfirmation } = req.body;

  if (!userType || !email || !phone || !password || !passwordConfirmation || !name) {
    throw new CustomError(422, "필수 필드를 모두 입력해주세요.");
  }

  if (![UserType.CUSTOMER, UserType.DRIVER].includes(userType)) {
    throw new CustomError(422, "userType은 'CUSTOMER' 또는 'DRIVER' 여야 합니다.");
  }

  const commonData = { email, phone, password, passwordConfirmation, name, userType };

  const result = await authService.signUpUser(commonData);

  res.status(201).json(result);
});

// 로그인
const logIn = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, userType } = req.body;

  if (!email || !password || !userType) {
    throw new CustomError(422, "이메일, 비밀번호, 사용자 타입을 모두 입력해주세요.");
  }

  if (![UserType.CUSTOMER, UserType.DRIVER].includes(userType)) {
    throw new CustomError(422, "userType은 'CUSTOMER' 또는 'DRIVER' 여야 합니다.");
  }

  const { accessToken, refreshToken, user } = await authService.signInUser(email, password, userType);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    domain: getCookieDomain()
  });

  res.json({ accessToken, user });
});

// 로그아웃
const logOut = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    domain: getCookieDomain()
  });
  res.status(200).json({ message: "성공적으로 로그아웃되었습니다." });
});

// 지원하는 소셜 로그인 provider 목록
// 카카오, 네이버 로그인 제거됨
const SUPPORTED_PROVIDERS = ["google"] as const;
type Provider = (typeof SUPPORTED_PROVIDERS)[number];

// 소셜 로그인 시작
const startSocialLogin = (req: Request, res: Response, next: NextFunction) => {
  const { provider } = req.params;
  const { userType = UserType.CUSTOMER } = req.query;

  if (!SUPPORTED_PROVIDERS.includes(provider as Provider)) {
    res.status(400).json({ message: "지원하지 않는 소셜 로그인입니다." });
    return;
  }

  if (![UserType.CUSTOMER, UserType.DRIVER].includes(userType as UserType)) {
    res.status(422).json({ message: "userType은 'CUSTOMER' 또는 'DRIVER' 여야 합니다." });
    return;
  }

  // Google OAuth 환경 변수 확인
  if (provider === "google") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("❌ Google OAuth 환경 변수가 설정되지 않았습니다.");
      res.status(500).json({ message: "Google 로그인 설정 오류가 발생했습니다." });
      return;
    }
  }

  // 구글 로그인만 지원
  const scopes = ["profile", "email"];

  // userType을 state에 담아 passport-strategy로 전달
  passport.authenticate(provider, {
    scope: scopes,
    state: userType as string
  })(req, res, next);
};

// 소셜 로그인 콜백
const socialLoginCallback = (req: Request, res: Response, next: NextFunction) => {
  const { provider } = req.params;
  const failureRedirectUrl = `${process.env.CLIENT_URL}/login/customer`;

  if (!SUPPORTED_PROVIDERS.includes(provider as Provider)) {
    return res.redirect(failureRedirectUrl);
  }

  passport.authenticate(
    provider,
    { session: false },
    async (err: Error | null, user?: TokenUserPayload): Promise<void> => {
      if (err || !user) {
        return res.redirect(failureRedirectUrl);
      }

      try {
        const { accessToken, refreshToken } = await authService.handleSocialLogin(user);

        const cookieDomain = getCookieDomain();
        const clientUrl = process.env.CLIENT_URL || "";

        // 쿠키 설정 로그 (디버깅용)
        console.log("🍪 쿠키 설정 정보:");
        console.log(`  CLIENT_URL: ${clientUrl}`);
        console.log(`  Cookie Domain: ${cookieDomain || "undefined (same domain)"}`);
        console.log(`  Redirect URL: ${clientUrl || "/"}`);

        // 크로스 도메인 쿠키 설정을 위한 옵션
        const cookieOptions = {
          httpOnly: false, // accessToken은 클라이언트에서 읽을 수 있어야 함
          sameSite: "none" as const, // 크로스 도메인을 위해 none 사용
          secure: true, // HTTPS 필수
          maxAge: 15 * 60 * 1000, // 15분
          path: "/",
          ...(cookieDomain ? { domain: cookieDomain } : {}) // 도메인이 있으면 설정, 없으면 생략
        };

        const refreshCookieOptions = {
          httpOnly: true,
          sameSite: "none" as const, // 크로스 도메인을 위해 none 사용
          secure: true,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
          path: "/",
          ...(cookieDomain ? { domain: cookieDomain } : {})
        };

        res.cookie("accessToken", accessToken, cookieOptions);
        res.cookie("refreshToken", refreshToken, refreshCookieOptions);

        // 환영 토스트를 띄우기 위한 임시 쿠키 설정 (유효시간 60초)
        res.cookie("welcome_toast", "true", {
          httpOnly: false,
          sameSite: "none" as const,
          secure: true,
          maxAge: 60 * 1000,
          path: "/",
          ...(cookieDomain ? { domain: cookieDomain } : {})
        });

        // 로그인 성공 후 클라이언트 메인 페이지로 리다이렉트 (쿠키를 URL 파라미터로도 전달)
        const redirectUrl = new URL(clientUrl || "/", clientUrl);
        redirectUrl.searchParams.set("accessToken", accessToken);
        redirectUrl.searchParams.set("loggedIn", "true");

        console.log(`✅ 로그인 성공, 리다이렉트: ${redirectUrl.toString()}`);
        return res.redirect(redirectUrl.toString());
      } catch (error) {
        next(error);
      }
    }
  )(req, res, next);
};

// 로그인된 유저 인증(최소) 정보 조회
const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new CustomError(401, "인증 정보가 없습니다.");
  }

  res.json({ user: req.user });
});

// 로그인된 유저 이름 조회
const getMeName = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new CustomError(401, "인증 정보가 없습니다.");
  }
  const authUserId = req.user.id;
  const user = await authRepository.findNameById(authUserId);

  if (!user) {
    return next(new CustomError(404, "사용자를 찾을 수 없습니다."));
  }

  res.status(200).json({ name: user.name, profileImage: user.profileImage });
});

// 로그인된 유저 자세한 정보 조회
const getUserById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new CustomError(401, "인증 정보가 없습니다.");
  }
  const { id } = req.user;
  const user = await authService.getUserById(id);

  if (!user) {
    throw new CustomError(404, "정보를 찾을 수 없습니다.");
  }

  const { password, ...publicUser } = user;

  res.json(publicUser);
});

// 액세스 토큰 재발급
const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new CustomError(401, "토큰 갱신을 위한 사용자 정보가 없습니다.");
  }
  const newAccessToken = await authService.generateNewAccessToken(req.user);
  res.json({ accessToken: newAccessToken });
});

export default {
  signUp,
  logIn,
  logOut,
  getMe,
  startSocialLogin,
  socialLoginCallback,
  getUserById,
  refreshToken,
  getMeName
};
