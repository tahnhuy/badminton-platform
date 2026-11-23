import type { RecruitmentDraft, RecruitmentProjection } from '../matchmaking/types/recruitment';
export type PostBackground = 'forest' | 'ocean' | 'sunset' | 'berry' | 'midnight' | 'confetti';
export interface Person { id: number; displayName: string | null; avatarUrl: string | null }
export interface PostCard {
  id: number; type: 'FREE' | 'MATCH_FINDING'; title: string | null; body: string | null;
  author: Person & { skillLevel: { id: number; name: string } | null }; isAuthor: boolean;
  publishedAt: string | null; editedAt: string | null; isEdited: boolean; createdAt: string;
  background?: PostBackground | null;
  images: { id: number; url: string; position: number }[];
  reactions: { counts: Record<string, number>; total: number; viewerReaction: string | null };
  commentCount: number; recruitment: RecruitmentProjection | null;
}
export interface PostComment { id: number; postId: number; body: string; author: Person; createdAt: string; canDelete: boolean }
export interface PageMeta { page: number; limit: number; total: number; totalPages: number; asOf?: string }
export interface PageResult<T> { data: T[]; meta: PageMeta }
export interface PostPayload { background?: PostBackground | null; type: 'FREE' | 'MATCH_FINDING'; body: string; title?: string; publish?: boolean; recruitment?: RecruitmentDraft; clientRequestId: string }
export type FeedFilters = Record<string, string>;
