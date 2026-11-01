import { loadConfigValues, clearConfigCache } from './config-registry';

// Typed facade for the Social keys (matrix §8.9; SC-12). Gate checks happen in
// Social services (System Config Tech Design, Social Matchmaking extension).
const socialKeys = ['SOCIAL_FEED_ENABLED', 'SOCIAL_FREE_POSTS_PER_DAY', 'SOCIAL_COMMENTS_PER_MINUTE'] as const;

export interface SocialConfig {
  feedEnabled: boolean;
  freePostsPerDay: number;
  commentsPerMinute: number;
}

export const socialConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<SocialConfig> {
    const values = await loadConfigValues(socialKeys);
    return {
      feedEnabled: values.SOCIAL_FEED_ENABLED,
      freePostsPerDay: values.SOCIAL_FREE_POSTS_PER_DAY,
      commentsPerMinute: values.SOCIAL_COMMENTS_PER_MINUTE,
    };
  },
};
