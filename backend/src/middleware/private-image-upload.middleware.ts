import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { MEDIA_IMAGE_MAX_BYTES, MEDIA_IMAGE_MAX_COUNT } from '../validation/media-images';

// Multipart parsing for private images (Social Tech Design §7.4): memory storage,
// 5 MB per image, at most 4 images, bounded parts. Mounted by SOC-03 / MSG-04 routes.
export function parsePrivateImages(field: string, invalidImageCode: string, payloadField = 'payload', countLimitCode = invalidImageCode) {
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MEDIA_IMAGE_MAX_BYTES,
      files: MEDIA_IMAGE_MAX_COUNT,
      fields: 1,
      parts: MEDIA_IMAGE_MAX_COUNT + 1,
      fieldNameSize: 100,
      fieldSize: 64 * 1024,
    },
  }).fields([{ name: field, maxCount: MEDIA_IMAGE_MAX_COUNT }]);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.is('multipart/form-data')) return next();
    parse(req, res, error => {
      if (error) {
        // More than 4 images (Social Tech Design §9: SOCIAL_IMAGE_LIMIT) vs an invalid file.
        const { code, field: errorField } = error as { code?: string; field?: string };
        if (code === 'LIMIT_FILE_COUNT' || (code === 'LIMIT_UNEXPECTED_FILE' && errorField === field)) {
          return next(new AppError(countLimitCode, 400, 'Tối đa 4 ảnh cho mỗi bài viết.'));
        }
        return next(new AppError(invalidImageCode, 400, 'Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh và tối đa 4 ảnh.'));
      }
      const body = req.body as Record<string, unknown> | undefined;
      if (body && Object.keys(body).some(key => key !== payloadField)) {
        return next(new AppError('VALIDATION_FAILED', 400, 'Unexpected multipart field'));
      }
      next();
    });
  };
}
