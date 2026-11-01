export const REACTIONS = [
  { type: 'LIKE', label: 'Thích', emoji: '👍' }, { type: 'LOVE', label: 'Yêu thích', emoji: '❤️' },
  { type: 'HAHA', label: 'Haha', emoji: '😂' }, { type: 'WOW', label: 'Wow', emoji: '😮' },
  { type: 'SAD', label: 'Buồn', emoji: '😢' }, { type: 'ANGRY', label: 'Phẫn nộ', emoji: '😡' },
] as const;
export type ReactionType = typeof REACTIONS[number]['type'];
