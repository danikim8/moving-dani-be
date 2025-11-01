import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { CustomError } from "../utils/customError";
import profileService from "../services/profile.service";
import { UserType } from "@prisma/client";
import { getCookieDomain } from "../utils/getCookieDomain";
import { getImageUrl } from "../middlewares/uploadMiddleware";

declare global {
  namespace Express {
    interface User {
      id: string;
      userType: UserType;
    }
  }
}

// 프로필 이미지 업로드
const uploadProfileImage = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new CustomError(400, "업로드할 프로필 이미지가 없습니다.");
  }

  // AWS S3 제거 - 로컬 파일 저장 또는 외부 스토리지 서비스 사용
  const imageUrl = getImageUrl(file.filename);

  res.status(201).json({
    message: "프로필 이미지가 성공적으로 업로드되었습니다.",
    imageUrl
  });
});

// 고객 프로필 생성
const createCustomerProfile = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.user?.id;

  if (!authUserId) throw new CustomError(401, "인증 정보가 없습니다.");

  const { profileImage, moveType, currentArea } = req.body;

  const { profile, accessToken, refreshToken } = await profileService.createCustomerProfile(authUserId, {
    profileImage,
    moveType,
    currentArea
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    domain: getCookieDomain()
  });
  res.status(201).json({ profile, accessToken });
});

// 고객 프로필 수정
const updateCustomerProfile = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.user?.id;

  if (!authUserId) throw new CustomError(401, "인증 정보가 없습니다.");

  const {
    name,
    email,
    phone,
    currentPassword,
    newPassword,
    passwordConfirmation,
    profileImage,
    moveType,
    currentArea
  } = req.body;

  const updated = await profileService.updateCustomerProfile(authUserId, {
    name,
    email,
    phone,
    currentPassword,
    newPassword,
    passwordConfirmation,
    profileImage,
    moveType,
    currentArea
  });

  res.json(updated);
});

// // 고객 프로필 조회
// const getCustomerProfile = asyncHandler(async (req: Request, res: Response) => {
//   const customerId = req.params.id;
//   const profile = await profileService.getCustomerProfile(customerId);
//   res.json(profile);
// });

// 기사 프로필 생성
const createDriverProfile = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.user?.id;

  if (!authUserId) throw new CustomError(401, "인증 정보가 없습니다.");

  const { profileImage, nickname, career, shortIntro, detailIntro, moveType, serviceAreas } = req.body;

  const { profile, accessToken, refreshToken } = await profileService.createDriverProfile(authUserId, {
    profileImage,
    nickname,
    career,
    shortIntro,
    detailIntro,
    moveType,
    serviceAreas
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    domain: getCookieDomain()
  });

  res.status(201).json({ profile, accessToken });
});

// 기사 프로필 수정
const updateDriverProfile = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.user?.id;

  if (!authUserId) throw new CustomError(401, "인증 정보가 없습니다.");

  const { profileImage, nickname, career, shortIntro, detailIntro, moveType, serviceAreas } = req.body;

  const updated = await profileService.updateDriverProfile(authUserId, {
    profileImage,
    nickname,
    career,
    shortIntro,
    detailIntro,
    moveType,
    serviceAreas
  });

  res.json(updated);
});

// // 기사 프로필 조회
// const getDriverProfile = asyncHandler(async (req: Request, res: Response) => {
//   const driverId = req.params.id;
//   const profile = await profileService.getDriverProfile(driverId);
//   res.json(profile);
// });

const updateDriverBasicProfile = asyncHandler(async (req: Request, res: Response) => {
  const authUserId = req.user?.id;
  if (!authUserId) throw new CustomError(401, "인증 정보가 없습니다.");
  const { name, phone, currentPassword, newPassword, passwordConfirmation } = req.body;

  const updated = await profileService.updateDriverBasicProfile(authUserId, {
    name,
    phone,
    currentPassword,
    newPassword,
    passwordConfirmation
  });
  res.json(updated);
});

export default {
  createCustomerProfile,
  updateCustomerProfile,
  // getCustomerProfile,
  createDriverProfile,
  updateDriverProfile,
  // getDriverProfile,
  updateDriverBasicProfile,
  uploadProfileImage
};
