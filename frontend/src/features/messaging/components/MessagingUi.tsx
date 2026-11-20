import type { ReactNode } from 'react';
import { LockKeyhole, Users } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { ConversationItem } from '../types/messaging.types';
export function MessagingAvatar({ name, group, avatarUrl }: { name: string; group?: boolean; avatarUrl?: string | null }) {
  return avatarUrl ? <img src={avatarUrl} alt={name} className="size-11 shrink-0 rounded-full object-cover" /> : <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold', group ? 'bg-success-bg text-primary' : 'bg-primary text-primary-foreground')}>{group ? <Users className="size-5" /> : name.charAt(0).toUpperCase()}</span>;
}
export function MessagingDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="z-1000 max-h-[85svh] overflow-y-auto" overlayClassName="z-1000">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription className="sr-only">{title}</DialogDescription>
      <div className="mt-5 space-y-4">{children}</div>
    </DialogContent>
  </Dialog>;
}
export type ConversationFilter = 'ALL' | 'UNREAD' | 'GROUP';
export function ConversationFilters({ value, onChange, groupLabel = 'Nhóm chat' }: { value: ConversationFilter; onChange: (value: ConversationFilter) => void; groupLabel?: string }) {
  return <ToggleGroup type="single" value={value} aria-label="Lọc cuộc trò chuyện" onValueChange={next => { if (next) onChange(next as ConversationFilter); }}>
    <ToggleGroupItem value="ALL">Tất cả</ToggleGroupItem>
    <ToggleGroupItem value="UNREAD">Chưa đọc</ToggleGroupItem>
    <ToggleGroupItem value="GROUP">{groupLabel}</ToggleGroupItem>
  </ToggleGroup>;
}
export function ConversationListItem({ conversation: conv, selected, online, onClick }: { conversation: ConversationItem; selected?: boolean; online?: boolean | null; onClick: () => void }) {
  const name = conv.type === 'GROUP' ? conv.title || 'Nhóm cầu lông' : conv.counterpart?.fullName || 'Người chơi';
  const previewText = conv.lastMessage ? conv.lastMessage.deletedAt ? 'Tin nhắn đã được thu hồi' : conv.lastMessage.body || '[Đính kèm tệp / hình ảnh]' : 'Chưa có tin nhắn';
  return <button type="button" aria-current={selected ? 'true' : undefined} onClick={onClick} className={cn('flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent p-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring', selected && 'border-primary/20 bg-accent')}>
    <span className="relative shrink-0">
      <MessagingAvatar name={name} group={conv.type === 'GROUP'} />{online && <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-success" title="Đang hoạt động (gần thời gian thực)" />}</span>
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold">{conv.isLocked && <LockKeyhole aria-label="Đã khóa" className="size-3.5 shrink-0" />}<span className="truncate">{name}</span>
        </span>{conv.lastMessageAt && <span className="shrink-0 text-xs text-muted-foreground">{new Date(conv.lastMessageAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}</span>
      <span className="flex items-center gap-2">
        <span className={cn('min-w-0 flex-1 truncate text-sm text-muted-foreground', conv.unreadCount > 0 && 'font-semibold text-foreground')}>{previewText}</span>{conv.unreadCount > 0 && <Badge variant="success">{conv.unreadCount}</Badge>}</span>
    </span>
  </button>;
}
