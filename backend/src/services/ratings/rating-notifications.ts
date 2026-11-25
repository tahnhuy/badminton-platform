import { notificationService } from '../notifications/NotificationService';
import type { NotificationEvent, NotifyResult } from '../../contracts/NotificationService';
import type { TransactionContext } from '../../contracts/TransactionContext';
import type { RatingRow } from '../../repositories/ratings/RatingRepository';

// Rating extension approved 2026-11-23: a newly stored rating notifies its target.
// The event is inserted in the caller's rating transaction so a rollback removes both.
// Recipients are the rated Players; the rater's identity and scores are never included.
export const ratingNotifications = {
  received(tx: TransactionContext, ratings: readonly Pick<RatingRow, 'id' | 'ratedPlayerId'>[]): Promise<NotifyResult> {
    const events: NotificationEvent[] = ratings.map(rating => ({
      recipientId: rating.ratedPlayerId,
      type: 'RATING_RECEIVED',
      title: 'Bạn nhận được đánh giá mới',
      content: 'Một người chơi đã gửi đánh giá sau trận. Điểm đánh giá tổng hợp trong hồ sơ của bạn đã được cập nhật.',
      resource: { type: 'PROFILE', id: rating.ratedPlayerId },
      dedupKey: `rating-received:${rating.id}`,
    }));
    if (events.length === 0) return Promise.resolve({ insertedIds: [], duplicateCount: 0 });
    return notificationService.notify(tx, events);
  },
};
