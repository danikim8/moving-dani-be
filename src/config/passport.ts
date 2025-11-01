// src/config/passport.ts
import passport from "passport";
import jwt from "../middlewares/passport/jwtStrategy";
import { googleStrategy } from "../middlewares/passport/socialStrategy";

passport.use("access-token", jwt.accessTokenStrategy);
passport.use("refresh-token", jwt.refreshTokenStrategy);

passport.use("google", googleStrategy);
// 카카오, 네이버 로그인 제거됨

export default passport;
