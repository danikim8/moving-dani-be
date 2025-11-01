import path from "path";
import fs from "fs";
import multer, { FileFilterCallback, diskStorage } from "multer";
import { Request } from "express";
import { CustomError } from "../utils/customError";

// AWS S3 제거 - 로컬 파일 저장 또는 외부 스토리지 서비스 사용
// Render 배포 시: 파일 시스템은 임시적이므로 외부 스토리지 서비스 권장
// 예: Cloudinary, Imgur API, Vercel Blob Storage 등

// 업로드 디렉토리 생성
const uploadDir = path.join(process.cwd(), "uploads", "images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new CustomError(400, "지원하지 않는 파일 형식입니다. (jpeg, png, gif만 허용됩니다.)");
    cb(error);
  }
};

const uploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// 이미지 URL 생성 함수 (로컬 파일 기준)
export const getImageUrl = (filename: string): string => {
  // 프로덕션 환경에서는 외부 스토리지 서비스 URL을 사용해야 함
  // 예: process.env.IMAGE_BASE_URL || process.env.SERVER_URL
  const baseUrl = process.env.IMAGE_BASE_URL || process.env.SERVER_URL || "http://localhost:4000";
  return `${baseUrl}/uploads/images/${filename}`;
};

export default uploadMiddleware;
