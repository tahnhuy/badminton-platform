import type { ProfileRatingsReader } from '../../contracts/PlayerProfileRead';
import { ratingRepository } from '../../repositories/ratings/RatingRepository';

/**
 * Profile composition reuses Ratings aggregates instead of querying PLAYER_RATINGS
 * in Profile. Public and own reads expose the same aggregate projection; the Profile
 * dimension mapper hides averages below the 3-rating threshold.
 */
export const profileRatingsReader: ProfileRatingsReader = {
  async summary(userId, reader) {
    const aggregates = await ratingRepository.getAggregates(userId, reader);
    return {
      totalRatings: aggregates.totalRatings,
      averageSkillRating: aggregates.totalRatings > 0 ? aggregates.sumSkill / aggregates.totalRatings : null,
      averageAttitudeRating: aggregates.totalRatings > 0 ? aggregates.sumAttitude / aggregates.totalRatings : null,
    };
  },
};
