import type { MediaAccessResolver } from '../../contracts/PrivateMediaService';
import { courtStandardRepository } from '../../repositories/facility/CourtStandardRepository';

/**
 * Court standard evidence is private: the owning Court Owner and Admins may read it.
 * There is no public URL; the generic media route enforces access on every request.
 */
export const courtStandardEvidenceAccessResolver: MediaAccessResolver = async (media, viewer) => {
  return courtStandardRepository.viewerMayReadEvidence(media.id, viewer);
};
