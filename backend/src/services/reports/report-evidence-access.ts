import type { MediaAccessResolver } from '../../contracts/PrivateMediaService';
import { reportRepository } from '../../repositories/reports/ReportRepository';

// RP-07: evidence media are private to report handling. The Admin-only report route
// verifies the (reportId, mediaId) pair before asking the media service to stream it.
export const reportEvidenceMediaAccessResolver: MediaAccessResolver = async (media, viewer) => {
  if (viewer.role !== 'ADMIN') return false;
  return reportRepository.hasEvidenceForMedia(media.id);
};
