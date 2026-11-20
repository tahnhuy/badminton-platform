import type { MessageReactionType } from '../types/messaging.types';
export const REACTION_META: Array<{ type: MessageReactionType; emoji: string; label: string }> = [
  { type: 'LIKE', emoji: '👍', label: 'Thích' }, { type: 'LOVE', emoji: '❤️', label: 'Tim' },
  { type: 'HAHA', emoji: '😆', label: 'Haha' }, { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'SAD', emoji: '😢', label: 'Buồn' }, { type: 'ANGRY', emoji: '😡', label: 'Phẫn nộ' },
];
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
