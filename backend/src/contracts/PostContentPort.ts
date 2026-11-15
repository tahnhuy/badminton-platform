import type { TransactionContext } from './TransactionContext';

// Matchmaking Tech Design §24.2: PostContentPort. Provider: Social. Consumer: Matchmaking.
// Operations take the caller's transaction; the provider never commits.

export interface PostContentPort {
  /** Sets POSTS.published_at once (rank 100). Returns the stored value (unchanged if already set). */
  markPublished(postId: number, at: Date, tx: TransactionContext): Promise<Date | null>;
  /** Social canView for an authenticated Player (Social Tech Design §7.3). */
  isVisible(postId: number, viewerId: number, reader?: TransactionContext): Promise<boolean>;
}
