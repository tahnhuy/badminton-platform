import type { PostBackground } from '../types';

export const postBackgrounds: { id: PostBackground; label: string; className: string }[] = [
  { id: 'forest', label: 'Rừng xanh', className: 'bg-gradient-to-br from-emerald-800 to-teal-600 text-white' },
  { id: 'ocean', label: 'Đại dương', className: 'bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-700 text-white' },
  { id: 'sunset', label: 'Hoàng hôn', className: 'bg-gradient-to-br from-rose-800 via-red-700 to-orange-700 text-white' },
  { id: 'berry', label: 'Sắc tím', className: 'bg-gradient-to-br from-violet-900 via-purple-800 to-fuchsia-800 text-white' },
  { id: 'midnight', label: 'Đêm sao', className: 'bg-[radial-gradient(ellipse_at_top_right,#475569,#0f172a_75%)] text-white' },
  { id: 'confetti', label: 'Ngày vui', className: 'bg-[radial-gradient(circle_at_15%_20%,#ffffff18_0_8%,transparent_8%),radial-gradient(circle_at_85%_80%,#ffffff18_0_15%,transparent_15%),linear-gradient(135deg,#9d174d,#6b21a8)] text-white' },
];
export const backgroundClass = (id?: string | null) => postBackgrounds.find(item => item.id === id)?.className;
