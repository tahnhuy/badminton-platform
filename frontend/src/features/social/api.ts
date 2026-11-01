import { httpClient } from '../../shared/api/http-client';
import type { ReactionType } from '../../components/common/reactions';
import type { FeedFilters, PageResult, PostCard, PostComment, PostPayload } from './types';
const posts = '/api/v1/posts';
function multipart(payload: unknown, images: File[]) {
  const form = new FormData(); form.append('payload', JSON.stringify(payload));
  images.forEach(file => form.append('images', file)); return form;
}
export const socialApi = {
  feed: (filters: FeedFilters, page: number, asOf?: string, signal?: AbortSignal) => httpClient<PageResult<PostCard>>(`${posts}?${new URLSearchParams({ ...filters, page: String(page), limit: '10', ...(asOf ? { asOf } : {}) })}`, { signal }),
  post: async (id: number) => (await httpClient<{ data: PostCard }>(`${posts}/${id}`)).data,
  create: async (payload: PostPayload, images: File[]) => (await httpClient<{ data: PostCard }>(posts, { method: 'POST', body: multipart(payload, images) })).data,
  edit: async (id: number, payload: { body: string; title?: string; keepImageIds: number[] }, images: File[]) => (await httpClient<{ data: PostCard }>(`${posts}/${id}`, { method: 'PATCH', body: multipart(payload, images) })).data,
  delete: (id: number) => httpClient(`${posts}/${id}?bookingAction=KEEP`, { method: 'DELETE' }),
  reaction: (id: number, type: ReactionType | null) => httpClient(`${posts}/${id}/reaction`, { method: type ? 'PUT' : 'DELETE', ...(type ? { body: JSON.stringify({ type }) } : {}) }),
  comments: (id: number, page = 1, signal?: AbortSignal) => httpClient<PageResult<PostComment>>(`${posts}/${id}/comments?page=${page}&limit=20`, { signal }),
  comment: async (id: number, body: string, clientRequestId: string) => (await httpClient<{ data: PostComment }>(`${posts}/${id}/comments`, { method: 'POST', body: JSON.stringify({ body, clientRequestId }) })).data,
  deleteComment: (id: number) => httpClient(`/api/v1/comments/${id}`, { method: 'DELETE' }),
};
