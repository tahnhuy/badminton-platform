import type { FormEventHandler } from 'react';
import { MessageCircle, Users } from 'lucide-react';
import { MessagingDialog, MessagingAvatar } from './MessagingUi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import type { PlayerDisplay } from '../types/messaging.types';
interface SearchProps { open: boolean; onClose: () => void; query: string; onQueryChange: (value: string) => void; players: PlayerDisplay[]; error: string | null; submitting: boolean }
export function StartDirectDialog({ open, onClose, query, onQueryChange, players, error, submitting, onStart }: SearchProps & { onStart: (id: number) => void }) {
  return <MessagingDialog open={open} onClose={onClose} title="Bắt đầu trò chuyện 1-1">{error && <Alert variant="destructive">{error}</Alert>}<Input aria-label="Tìm người chơi theo tên" placeholder="Tìm người chơi theo tên..." value={query} onChange={e => onQueryChange(e.target.value)} />
    <div className="space-y-2">{players.map(p => <div key={p.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-3">
      <PlayerIdentity player={p} />
      <Button disabled={submitting} onClick={() => onStart(p.id)}>
        <MessageCircle aria-hidden="true" />Nhắn tin</Button>
    </div>)}</div>
  </MessagingDialog>;
}
export function StartGroupDialog({ open, onClose, query, onQueryChange, players, error, submitting, title, onTitleChange, selectedIds, onToggleMember, onSubmit }: SearchProps & { title: string; onTitleChange: (value: string) => void; selectedIds: number[]; onToggleMember: (id: number, checked: boolean) => void; onSubmit: FormEventHandler<HTMLFormElement> }) {
  return <MessagingDialog open={open} onClose={onClose} title="Tạo nhóm chat cầu lông">
    <form onSubmit={onSubmit} className="space-y-4">{error && <Alert variant="destructive">{error}</Alert>}<label className="block space-y-2 text-sm font-semibold">Tên nhóm (1–120 ký tự)<Input placeholder="Ví dụ: Hội cầu lông tối thứ 3 - Sân Kỳ Hòa" maxLength={120} value={title} onChange={e => onTitleChange(e.target.value)} />
    </label>
      <label className="block space-y-2 text-sm font-semibold">Tìm và chọn thành viên ({selectedIds.length} đã chọn)<Input placeholder="Nhập tên người chơi..." value={query} onChange={e => onQueryChange(e.target.value)} />
      </label>
      <div className="space-y-2">{players.map(p => <label key={p.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-accent">
        <PlayerIdentity player={p} />
        <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={selectedIds.includes(p.id)} onChange={() => onToggleMember(p.id, selectedIds.includes(p.id))} />
      </label>)}</div>
      <Button type="submit" className="w-full" disabled={submitting}>
        <Users aria-hidden="true" />{submitting ? 'Đang tạo...' : 'Tạo nhóm chat'}</Button>
    </form>
  </MessagingDialog>;
}
function PlayerIdentity({ player }: { player: PlayerDisplay }) {
  return <span className="flex min-w-0 items-center gap-3">
    <MessagingAvatar name={player.fullName} />
    <span className="min-w-0">
      <span className="block break-words text-sm font-semibold">{player.fullName}</span>{player.skillLevel && <span className="block text-xs text-muted-foreground">{player.skillLevel.name}</span>}</span>
  </span>;
}
