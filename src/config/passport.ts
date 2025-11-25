// src/config/passport.ts
import passport from "passport";
import jwt from "../middlewares/passport/jwtStrategy";
import { googleStrategy } from "../middlewares/passport/socialStrategy";

passport.use("access-token", jwt.accessTokenStrategy);
passport.use("refresh-token", jwt.refreshTokenStrategy);

// Google OAuth가 설정된 경우에만 Strategy 등록
if (googleStrategy) {
passport.use("google", googleStrategy);
  console.log("✅ Google OAuth Strategy가 등록되었습니다.");
} else {
  console.warn("⚠️  Google OAuth Strategy가 등록되지 않았습니다 (환경 변수 누락)");
}
// 카카오, 네이버 로그인 제거됨

export default passport;
