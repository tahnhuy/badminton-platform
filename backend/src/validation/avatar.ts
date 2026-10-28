import sharp from 'sharp';
import { ValidationError } from '../errors/AppError';
import { AVATAR_MAX_BYTES } from '../shared/storage/avatar-storage';

const MIME_FORMATS: Record<string, 'jpeg' | 'png' | 'webp'> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
export async function normalizeAvatar(file: Pick<Express.Multer.File, 'buffer' | 'mimetype'>): Promise<{ bytes: Buffer; format: string }> {
  const format = MIME_FORMATS[file.mimetype];
  if (!format || !file.buffer.length || file.buffer.length > AVATAR_MAX_BYTES) {
    throw new ValidationError('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 2 MB.');
  }
  try {
    const signature = format === 'jpeg' ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : format === 'png' ? file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.buffer.toString('ascii', 0, 4) === 'RIFF' && file.buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!signature) throw new Error('Image signature mismatch');
    const image = sharp(file.buffer, { failOn: 'warning', limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (metadata.format !== format) throw new Error('Image format mismatch');
    const bytes = await image.rotate().toFormat(format).toBuffer();
    if (!bytes.length || bytes.length > AVATAR_MAX_BYTES) throw new Error('Normalized image too large');
    return { bytes, format };
  } catch {
    throw new ValidationError('Không thể đọc ảnh. Chọn ảnh JPEG, PNG hoặc WebP hợp lệ, tối đa 2 MB.');
  }
}
