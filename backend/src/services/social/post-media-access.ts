import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { postImages } from '../../db/schema/social';
import type { MediaAccessResolver } from '../../contracts/PrivateMediaService';
import { postVisibility } from './post-visibility';

// Post-image branch of the media resolver (Social Tech Design §7.3–§7.4).
// Access = the shared canView of the owning post (SOC-05) and the image not detached.
// Detached images stay reachable only through report evidence (RP-07 resolver).
export const postImageAccessResolver: MediaAccessResolver = async (media, viewer) => {
  if (viewer.role !== 'PLAYER' || media.kind !== 'IMAGE') return false;
  const rows = await db
    .select({ postId: postImages.postId })
    .from(postImages)
    .where(and(eq(postImages.mediaId, media.id), isNull(postImages.detachedAt)));
  if (rows.length === 0) return false;
  const visible = await postVisibility.visiblePostIds(rows.map(row => row.postId), viewer);
  return visible.size > 0;
};
