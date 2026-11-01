import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { NotFoundError, UnauthorizedError } from '../../errors/AppError';
import { privateMediaService, PrivateMediaServiceImpl } from '../../services/media/PrivateMediaService';

export const mediaIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

function contentDisposition(kind: string, originalName: string | null): string {
  if (kind === 'IMAGE') return 'inline';
  const safe = (originalName ?? 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 255) || 'file';
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(originalName ?? 'file')}`;
}

export class MediaController {
  constructor(private readonly service: PrivateMediaServiceImpl = privateMediaService) {}

  // GET /api/v1/media/:id (Social Tech Design §7.4). Missing or unauthorized: 404 MEDIA_NOT_FOUND.
  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
      const { id } = req.params as unknown as z.infer<typeof mediaIdParamSchema>;
      const file = await this.service.openForDownload(id, { id: req.user.id, role: req.user.role });
      if (!file) throw new NotFoundError('Media not found', 'MEDIA_NOT_FOUND');
      res.status(200);
      res.setHeader('Content-Type', file.media.mimeType);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', contentDisposition(file.media.kind, file.media.originalName));
      res.setHeader('Cache-Control', 'private, no-store');
      file.stream.on('error', streamError => {
        file.stream.destroy();
        if (!res.headersSent) next(streamError);
        else res.destroy(streamError);
      });
      file.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  };
}

export const mediaController = new MediaController();
