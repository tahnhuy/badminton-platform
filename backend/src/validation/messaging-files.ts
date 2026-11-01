import crypto from 'crypto';
import path from 'path';
import { TextDecoder } from 'util';
import sharp from 'sharp';
import yauzl from 'yauzl';
import { AppError } from '../errors/AppError';
import {
  MESSAGE_FILE_MAX_BYTES,
  MESSAGE_IMAGE_MAX_BYTES,
} from '../shared/storage/private-media-storage';
import { logger } from '../shared/logging/logger';

export interface ValidatedAttachment {
  kind: 'IMAGE' | 'FILE';
  bytes: Buffer;
  mimeType: string;
  extension: 'jpeg' | 'png' | 'webp' | 'pdf' | 'docx' | 'xlsx' | 'txt';
  byteSize: number;
  sha256: string;
  originalName: string | null;
}

const IMAGE_MIME_MAP: Record<string, { format: 'jpeg' | 'png' | 'webp'; mimeType: string }> = {
  'image/jpeg': { format: 'jpeg', mimeType: 'image/jpeg' },
  'image/png': { format: 'png', mimeType: 'image/png' },
  'image/webp': { format: 'webp', mimeType: 'image/webp' },
};

const MAX_ZIP_ENTRIES = 2000;
const MAX_ZIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_CONTENT_TYPES_XML_BYTES = 256 * 1024; // 256 KB

const DOCX_MAIN_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const XLSX_MAIN_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';

export function sanitizeFileName(rawName: string | undefined, fallbackExt: string): string {
  const base = path.basename(rawName || `attachment.${fallbackExt}`);
  const cleaned = base
    .replace(/[\x00-\x1f\x7f"\\/:*?<>|]/g, '_')
    .trim();
  if (!cleaned) {
    return `attachment.${fallbackExt}`;
  }
  return cleaned.length > 255 ? cleaned.slice(0, 255) : cleaned;
}

export async function normalizeMessageImage(
  file: Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'originalname'>
): Promise<ValidatedAttachment> {
  const mapping = IMAGE_MIME_MAP[file.mimetype];
  if (!mapping || !file.buffer || file.buffer.length === 0 || file.buffer.length > MESSAGE_IMAGE_MAX_BYTES) {
    throw new AppError('MESSAGING_IMAGE_INVALID', 400, 'Ảnh đính kèm không hợp lệ (chỉ nhận JPEG, PNG, WebP tối đa 5 MB)');
  }

  try {
    const { format, mimeType } = mapping;
    const hasSignature =
      format === 'jpeg'
        ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : format === 'png'
          ? file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : file.buffer.toString('ascii', 0, 4) === 'RIFF' &&
            file.buffer.toString('ascii', 8, 12) === 'WEBP';

    if (!hasSignature) {
      throw new Error('Image signature mismatch');
    }

    const image = sharp(file.buffer, { failOn: 'warning', limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (metadata.format !== format) {
      throw new Error('Image format mismatch');
    }

    const bytes = await image.rotate().toFormat(format).toBuffer();
    if (!bytes.length || bytes.length > MESSAGE_IMAGE_MAX_BYTES) {
      throw new Error('Normalized image exceeds size limit');
    }

    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    return {
      kind: 'IMAGE',
      bytes,
      mimeType,
      extension: format,
      byteSize: bytes.length,
      sha256,
      originalName: null,
    };
  } catch {
    logger.warn('Message image validation failed', { declaredMime: file.mimetype });
    throw new AppError('MESSAGING_IMAGE_INVALID', 400, 'Ảnh đính kèm không hợp lệ (chỉ nhận JPEG, PNG, WebP tối đa 5 MB)');
  }
}

function validatePdfBuffer(buffer: Buffer): void {
  if (buffer.length < 8) {
    throw new Error('PDF too short');
  }
  const header = buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new Error('Missing %PDF- header');
  }
  const tailStart = Math.max(0, buffer.length - 1024);
  const tail = buffer.subarray(tailStart).toString('latin1');
  if (!tail.includes('%%EOF')) {
    throw new Error('Missing %%EOF trailer within last 1 KB');
  }
}

function validateTxtBuffer(buffer: Buffer): void {
  if (buffer.includes(0x00)) {
    throw new Error('NUL byte in TXT file');
  }
  const decoder = new TextDecoder('utf-8', { fatal: true });
  decoder.decode(buffer);
}

function validateOpenXmlBuffer(buffer: Buffer, targetKind: 'docx' | 'xlsx'): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (reason: string) => {
      if (!settled) {
        settled = true;
        reject(new Error(reason));
      }
    };

    try {
      yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true }, (err, zipfile) => {
        if (err || !zipfile) {
          return fail('Invalid ZIP archive');
        }

        if (zipfile.entryCount > MAX_ZIP_ENTRIES) {
          zipfile.close();
          return fail('Too many ZIP entries');
        }

        let entryCount = 0;
        let totalUncompressed = 0;
        let hasMainDocument = false;
        let contentTypesXmlContent: string | null = null;

        zipfile.on('error', () => {
          zipfile.close();
          fail('ZIP parse error');
        });

        zipfile.on('entry', (entry: yauzl.Entry) => {
          if (settled) return;

          entryCount += 1;
          if (entryCount > MAX_ZIP_ENTRIES) {
            zipfile.close();
            return fail('ZIP entry count limit exceeded');
          }

          // Bit 0 of generalPurposeBitFlag indicates encryption
          if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
            zipfile.close();
            return fail('Encrypted ZIP entry not allowed');
          }

          totalUncompressed += entry.uncompressedSize;
          if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
            zipfile.close();
            return fail('Declared uncompressed size exceeds 100 MB');
          }

          const fileName = entry.fileName;
          const lowerName = fileName.toLowerCase();

          if (lowerName.endsWith('vbaproject.bin')) {
            zipfile.close();
            return fail('Macro-enabled Office file not allowed');
          }

          if (targetKind === 'docx' && fileName === 'word/document.xml') {
            hasMainDocument = true;
          } else if (targetKind === 'xlsx' && fileName === 'xl/workbook.xml') {
            hasMainDocument = true;
          }

          if (fileName === '[Content_Types].xml') {
            if (entry.uncompressedSize > MAX_CONTENT_TYPES_XML_BYTES) {
              zipfile.close();
              return fail('[Content_Types].xml exceeds 256 KB');
            }

            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                zipfile.close();
                return fail('Failed to read [Content_Types].xml');
              }

              const chunks: Buffer[] = [];
              let readBytes = 0;

              readStream.on('data', (chunk: Buffer) => {
                readBytes += chunk.length;
                if (readBytes > MAX_CONTENT_TYPES_XML_BYTES) {
                  readStream.destroy();
                  zipfile.close();
                  return fail('[Content_Types].xml stream exceeds 256 KB');
                }
                chunks.push(chunk);
              });

              readStream.on('error', () => {
                zipfile.close();
                fail('Error reading [Content_Types].xml stream');
              });

              readStream.on('end', () => {
                if (settled) return;
                contentTypesXmlContent = Buffer.concat(chunks).toString('utf-8');
                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          if (settled) return;
          if (!hasMainDocument || !contentTypesXmlContent) {
            return fail('Missing required OpenXML parts');
          }
          if (contentTypesXmlContent.toLowerCase().includes('macroenabled')) {
            return fail('Macro-enabled content type rejected');
          }
          const expectedContentType =
            targetKind === 'docx' ? DOCX_MAIN_CONTENT_TYPE : XLSX_MAIN_CONTENT_TYPE;
          if (!contentTypesXmlContent.includes(expectedContentType)) {
            return fail('OpenXML main content type mismatch');
          }
          settled = true;
          resolve();
        });

        zipfile.readEntry();
      });
    } catch {
      fail('Unexpected exception in OpenXML validator');
    }
  });
}

export async function validateMessageFile(
  file: Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'originalname'>
): Promise<ValidatedAttachment> {
  if (!file.buffer || file.buffer.length === 0 || file.buffer.length > MESSAGE_FILE_MAX_BYTES) {
    throw new AppError(
      'MESSAGING_FILE_INVALID',
      400,
      'Tệp đính kèm không hợp lệ (chỉ nhận PDF, DOCX, XLSX, TXT tối đa 10 MB)'
    );
  }

  const rawExt = path.extname(file.originalname || '').toLowerCase();
  let extension: 'pdf' | 'docx' | 'xlsx' | 'txt';
  let mimeType: string;

  if (rawExt === '.pdf') {
    extension = 'pdf';
    mimeType = 'application/pdf';
  } else if (rawExt === '.txt') {
    extension = 'txt';
    mimeType = 'text/plain; charset=utf-8';
  } else if (rawExt === '.docx') {
    extension = 'docx';
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (rawExt === '.xlsx') {
    extension = 'xlsx';
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    logger.warn('Message file validation failed', { ext: rawExt });
    throw new AppError(
      'MESSAGING_FILE_INVALID',
      400,
      'Định dạng tệp không được hỗ trợ (chỉ nhận PDF, DOCX, XLSX, TXT)'
    );
  }

  try {
    if (extension === 'pdf') {
      validatePdfBuffer(file.buffer);
    } else if (extension === 'txt') {
      validateTxtBuffer(file.buffer);
    } else {
      await validateOpenXmlBuffer(file.buffer, extension);
    }
  } catch {
    logger.warn('Message file format check failed', { extension });
    throw new AppError(
      'MESSAGING_FILE_INVALID',
      400,
      'Nội dung tệp đính kèm không hợp lệ hoặc bị hỏng'
    );
  }

  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  return {
    kind: 'FILE',
    bytes: file.buffer,
    mimeType,
    extension,
    byteSize: file.buffer.length,
    sha256,
    originalName: sanitizeFileName(file.originalname, extension),
  };
}

