import sharp from 'sharp';

// Social Tech Design §7.4 / matrix §3.13: JPEG/PNG/WebP, ≤ 5 MB each, ≤ 4 per post or
// message. Decode with failOn 'warning' and a pixel limit, re-encode to the same format
// (sharp drops EXIF/GPS and other metadata unless asked to keep it).
export const MEDIA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_IMAGE_MAX_COUNT = 4;
// Same input pixel limit as the existing avatar pipeline (validation/avatar.ts).
const MAX_INPUT_PIXELS = 16_000_000;

const MIME_FORMATS: Record<string, 'jpeg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface NormalizedImage {
  bytes: Buffer;
  mimeType: string;
}

function signatureMatches(format: 'jpeg' | 'png' | 'webp', buffer: Buffer): boolean {
  if (format === 'jpeg') return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (format === 'png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

/** Returns the normalized image, or null when it is not an acceptable image. */
export async function normalizeMediaImage(input: { buffer: Buffer; mimetype: string }): Promise<NormalizedImage | null> {
  const format = MIME_FORMATS[input.mimetype];
  if (!format || !Buffer.isBuffer(input.buffer) || input.buffer.length === 0 || input.buffer.length > MEDIA_IMAGE_MAX_BYTES) {
    return null;
  }
  try {
    if (!signatureMatches(format, input.buffer)) return null;
    const image = sharp(input.buffer, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS });
    const metadata = await image.metadata();
    if (metadata.format !== format) return null;
    const bytes = await image.rotate().toFormat(format).toBuffer();
    if (bytes.length === 0 || bytes.length > MEDIA_IMAGE_MAX_BYTES) return null;
    return { bytes, mimeType: input.mimetype };
  } catch {
    return null;
  }
}
