import express from "express";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import * as Sentry from "@sentry/node";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import yaml from "yaml";
import path from "path";
import authRouter from "./routes/auth.router";
import profileRouter from "./routes/profile.router";
import driverRouter from "./routes/driver.router";
import favoriteRouter from "./routes/favorite.router";
import addressRouter from "./routes/address.router";
import estimateReqRouter from "./routes/estimateReq.router";
import reviewRouter from "./routes/review.router";
import { errorHandler } from "./middlewares/errorHandler";
import notificationRouter from "./routes/notification.router";
import customerEstimateRouter from "./routes/customerEstimate.router";
import driverPrivateRouter from "./routes/driverPrivate.router";
import shareEstimateRouter from "./routes/shareEstimate.router";
import { initializeCronJobs } from "./utils/cronScheduler";
import translateRouter from "./routes/translateRouter";

const app = express();
app.use(helmet());
app.use(morgan("combined"));
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://moving-dani.vercel.app" // 새 Vercel 배포 URL 추가
    ],
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// 업로드된 이미지 파일 서빙 (AWS S3 제거 후 로컬 파일 시스템 사용)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (req, res) => {
  res.send("Health Check Success");
});

app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/address", addressRouter);
app.use("/customer", estimateReqRouter);
app.use("/reviews", reviewRouter);

app.use("/drivers", driverRouter); // 공개 API
app.use("/driver", driverPrivateRouter); // 로그인된 기사용 API

app.use("/favorite", favoriteRouter);
app.use("/notification", notificationRouter);

app.use("/customer/estimate", customerEstimateRouter);

app.use("/estimate", shareEstimateRouter);
app.use("/translate", translateRouter);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(yaml.parse(fs.readFileSync(path.join(path.resolve(), "openapi.yaml"), "utf-8")))
);

// Cron 작업 초기화
initializeCronJobs();

Sentry.setupExpressErrorHandler(app);
app.use(errorHandler as express.ErrorRequestHandler);

export default app;
