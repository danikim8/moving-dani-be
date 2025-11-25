// src/middlewares/passport/socialStrategy.ts

import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// 카카오, 네이버 로그인 제거됨
import authService from "../../services/auth.service";
import { Profile as PassportProfile } from "passport";
import { AuthProvider, UserType } from "@prisma/client";
import { TokenUserPayload } from "../../services/auth.service";
import { Request } from "express";

type VerifiedCallback = (error: any, user?: Express.User | false, info?: any) => void;

// Profile 타입 확장 (passport 기본 Profile에 _json 프로퍼티 추가)
interface ProfileWithJson extends PassportProfile {
  _json?: any;
}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SERVER_URL, CLIENT_URL } = process.env;

// 환경 변수 검증 (서버 종료하지 않고 경고만 표시)
const isGoogleOAuthConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SERVER_URL && CLIENT_URL);

if (!isGoogleOAuthConfigured) {
  console.warn("⚠️  Google OAuth 환경 변수 누락:");
  console.warn(`  GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID ? "✅ 설정됨" : "❌ 없음"}`);
  console.warn(`  GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET ? "✅ 설정됨" : "❌ 없음"}`);
  console.warn(`  SERVER_URL: ${SERVER_URL || "❌ 없음"}`);
  console.warn(`  CLIENT_URL: ${CLIENT_URL || "❌ 없음"}`);
  console.warn("⚠️  Google 로그인이 비활성화됩니다. 환경 변수를 설정하고 서버를 재시작하세요.");
} else {
  console.log("✅ Google OAuth 환경 변수 확인 완료");
  console.log(`  Callback URL: ${SERVER_URL}/auth/social/google/callback`);
}

type NormalizedOAuthProfile = {
  provider: AuthProvider;
  providerId: string;
  email: string | null;
  displayName: string;
  profileImageUrl: string | null;
};

const createSocialVerify =
  (provider: AuthProvider) =>
  async (req: Request, accessToken: string, refreshToken: string, profile: ProfileWithJson, done: VerifiedCallback) => {
    try {
      // 구글은 profile.emails[0].value에서 이메일 추출
      const email = profile.emails?.[0]?.value || null;

      // state에 담겨온 userType 추출, 없으면 CUSTOMER로 기본값 설정
      const userType = (req.query.state as UserType) || UserType.CUSTOMER;

      const normalizedProfile: NormalizedOAuthProfile = {
        provider,
        providerId: profile.id,
        email,
        displayName: profile.displayName || "User",
        profileImageUrl: profile.photos?.[0]?.value || null
      };

      const user: TokenUserPayload = await authService.findOrCreateOAuthUser(normalizedProfile, userType);

      return done(null, user);
    } catch (error) {
      console.error(`Social login error for provider ${provider}:`, error);
      return done(error as Error);
    }
  };

// Google OAuth가 설정된 경우에만 Strategy 생성
export const googleStrategy = isGoogleOAuthConfigured
  ? new GoogleStrategy(
  {
        clientID: GOOGLE_CLIENT_ID!,
        clientSecret: GOOGLE_CLIENT_SECRET!,
    callbackURL: `${SERVER_URL}/auth/social/google/callback`,
    passReqToCallback: true
  },
  createSocialVerify(AuthProvider.GOOGLE)
    )
  : null;

// Google OAuth 설정 검증 로그
if (isGoogleOAuthConfigured) {
  console.log("🔍 Google OAuth Strategy 설정:");
  console.log(`  Client ID: ${GOOGLE_CLIENT_ID?.substring(0, 20)}...`);
  console.log(`  Client Secret: ${GOOGLE_CLIENT_SECRET ? "✅ 설정됨" : "❌ 없음"}`);
  console.log(`  Callback URL: ${SERVER_URL}/auth/social/google/callback`);
} else {
  console.log("⚠️  Google OAuth Strategy가 생성되지 않았습니다 (환경 변수 누락)");
}

// 카카오, 네이버 로그인 제거됨
