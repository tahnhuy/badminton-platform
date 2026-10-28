import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors/AppError';
import { AVATAR_MAX_BYTES } from '../shared/storage/avatar-storage';

const parse = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0, parts: 2, fieldNameSize: 100,
} }).single('avatar');

export function parseAvatarUpload(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) return next(new ValidationError('Cần gửi một ảnh trong trường avatar.'));
  parse(req, res, error => {
    if (error || !req.file) return next(new ValidationError('Cần gửi đúng một ảnh JPEG/PNG/WebP, tối đa 2 MB, trong trường avatar.'));
    next();
  });
}
