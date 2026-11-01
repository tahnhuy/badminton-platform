import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { postImages, posts } from '../../db/schema/social';
import type { MediaAccessResolver } from '../../contracts/PrivateMediaService';

// Post-image branch of the media resolver (Social Tech Design §7.3–§7.4, SOC-02).
// Access = canView(post, viewer) and the image is not detached.
//
// canView is completed by SOC-05. This resolver grants only what is already provable:
// an authenticated Player, the post neither deleted nor hidden, and either published or
// authored by the viewer. The unpublished-post access of Players with a PENDING/ACCEPTED
// recruitment membership (§7.3) is NOT granted yet; it stays denied until SOC-05 adds the
// shared canView over the MM-21/MM-22 membership model.
export const postImageAccessResolver: MediaAccessResolver = async (media, viewer) => {
  if (viewer.role !== 'PLAYER' || media.kind !== 'IMAGE') return false;
  const rows = await db
    .select({ authorId: posts.authorId, publishedAt: posts.publishedAt })
    .from(postImages)
    .innerJoin(posts, eq(posts.id, postImages.postId))
    .where(and(
      eq(postImages.mediaId, media.id),
      isNull(postImages.detachedAt),
      isNull(posts.deletedAt),
      isNull(posts.hiddenAt),
    ));
  return rows.some(row => row.publishedAt !== null || row.authorId === viewer.id);
};
