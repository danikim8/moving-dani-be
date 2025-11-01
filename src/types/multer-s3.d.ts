export {};

// AWS S3 제거됨 - 이제 multer의 기본 File 타입 사용
// location, key, bucket, etag는 더 이상 사용하지 않음
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        // AWS S3 관련 필드 제거됨
        // location, key, bucket, etag는 더 이상 사용하지 않음
      }
    }
  }
}
