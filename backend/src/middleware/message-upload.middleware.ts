import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { MESSAGE_FILE_MAX_BYTES } from '../shared/storage/private-media-storage';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MESSAGE_FILE_MAX_BYTES,
    files: 10,
    fields: 10,
    fieldNameSize: 100,
  },
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'file', maxCount: 5 },
]);

export function parseMessageUpload(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) {
    return next();
  }

  upload(req, res, (err: unknown) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const code = err.field === 'images' ? 'MESSAGING_IMAGE_INVALID' : 'MESSAGING_FILE_INVALID';
        return next(new AppError(code, 400, 'Tệp tải lên vượt quá dung lượng cho phép'));
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('MESSAGING_ATTACHMENT_LIMIT', 400, 'Số lượng tệp đính kèm vượt quá giới hạn'));
      }
    }

    return next(new AppError('VALIDATION_FAILED', 400, 'Dữ liệu tải lên không hợp lệ'));
  });
}

