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

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SERVER_URL || !CLIENT_URL) {
  console.error("환경 변수 누락");
  process.exit(1);
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

export const googleStrategy = new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${SERVER_URL}/auth/social/google/callback`,
    passReqToCallback: true
  },
  createSocialVerify(AuthProvider.GOOGLE)
);

// 카카오, 네이버 로그인 제거됨
