import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/popover';
import type { Dispatch, SetStateAction } from 'react';
import { MoreHorizontal, Reply, Pencil, Trash2, EyeOff, Download, Paperclip, SmilePlus, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import type { ConversationItem, MessageItem, MessageReactionType } from '../types/messaging.types';
import { REACTION_META, formatBytes } from './message-presentation';
interface Props {
  message: MessageItem; previous: MessageItem | null; meId?: number; conversation: ConversationItem;
  isGroupOwner: boolean; featureDisabled: boolean; highlighted: boolean; openMenuMsgId: number | null; dismissedHoverMsgId: number | null;
  setOpenMenuMsgId: Dispatch<SetStateAction<number | null>>; setDismissedHoverMsgId: Dispatch<SetStateAction<number | null>>;
  onReply: (message: MessageItem) => void; onEdit: (message: MessageItem) => void; onRecall: (message: MessageItem) => void; onHide: (message: MessageItem) => void;
  onReact: (message: MessageItem, type: MessageReactionType) => void; onQuote: (id: number) => void; onImage: (url: string) => void; onReport: (message: MessageItem) => void;
}
export function MessageBubble({ message: msg, previous: prevMsg, meId, conversation, isGroupOwner, featureDisabled, highlighted, openMenuMsgId, dismissedHoverMsgId, setOpenMenuMsgId, setDismissedHoverMsgId, onReply, onEdit, onRecall, onHide, onReact, onQuote, onImage, onReport }: Props) {
  const isMine = msg.senderId === meId;
  const isGroupedWithPrev = prevMsg !== null && prevMsg.senderId === msg.senderId && new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000;
  const isRecalled = Boolean(msg.deletedAt);
  const recalledByGroupOwner = isRecalled && msg.deletedByUserId !== null && msg.deletedByUserId !== msg.senderId;
  const imageAttachments = msg.attachments.filter(a => a.kind === 'IMAGE');
  const fileAttachments = msg.attachments.filter(a => a.kind === 'FILE');
  const senderIsOwner = conversation.type === 'GROUP' && msg.senderId === conversation.createdBy;
  const canEditMsg = isMine && !isRecalled && Boolean(msg.body) && conversation.canSend;
  const canRecallMsg = (isMine || isGroupOwner) && !isRecalled;
  return <div id={`msg-item-${msg.id}`} className={cn('group relative flex min-w-0 flex-col gap-1 rounded-lg', isMine ? 'items-end' : 'items-start', isGroupedWithPrev ? 'mt-1' : 'mt-4', highlighted && 'ring-2 ring-ring')} onMouseLeave={() => setDismissedHoverMsgId(cur => cur === msg.id ? null : cur)}>
    {!isMine && !isGroupedWithPrev && <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{msg.senderName}{senderIsOwner && <Badge>Chủ nhóm</Badge>}</span>}
    <div className={cn('max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere]', isMine ? 'rounded-br-md border-primary bg-primary text-primary-foreground' : 'rounded-bl-md border-border bg-muted/60', isRecalled && 'border-dashed border-border bg-muted text-muted-foreground italic')}>
      {!isRecalled && msg.parentMessage && <div role="button" tabIndex={0} className="mb-2 cursor-pointer rounded-lg border-l-2 border-current bg-card/15 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onQuote(msg.parentMessage!.id)} onKeyDown={e => { if (e.key === 'Enter') onQuote(msg.parentMessage!.id); }}>
        <span className="block text-xs font-bold">↩ {msg.parentMessage.senderName}</span>
        <span className="block text-xs">{msg.parentMessage.isRecalled ? 'Tin nhắn đã được thu hồi' : msg.parentMessage.body || (msg.parentMessage.hasAttachments ? '[Đính kèm tệp / ảnh]' : '')}</span>
      </div>}
      {isRecalled ? <p>{recalledByGroupOwner ? 'Tin nhắn đã bị chủ nhóm thu hồi' : 'Tin nhắn đã được thu hồi'}</p> : <>{msg.body && <div className="whitespace-pre-wrap">{msg.body}</div>}
        {imageAttachments.length > 0 && <div className={cn("mt-2 grid gap-2", imageAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2")}>{imageAttachments.map(att => <button type="button" key={att.id} className="min-w-0 overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Xem ảnh đính kèm" onClick={() => onImage(att.url)}>
          <img src={att.url} alt="Ảnh đính kèm" className="max-h-60 w-full object-cover" />
        </button>)}</div>}
        {fileAttachments.map(att => <a key={att.id} href={att.url} download={att.originalName || `attachment-${att.mediaId}`} className="mt-2 flex min-h-11 items-center gap-3 rounded-lg border border-current/20 bg-card/10 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Paperclip aria-hidden="true" className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{att.originalName || `Tệp #${att.mediaId}`}</span>
            <span className="block text-xs">{formatBytes(att.byteSize)} • Bấm để tải xuống</span>
          </span>
          <Download aria-label="Tải về" className="size-4 shrink-0" />
        </a>)}
        <div className="mt-1 flex justify-end gap-2 text-xs opacity-80">{msg.editedAt && <span>(đã chỉnh sửa)</span>}<span>{new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </>}
    </div>
    {!featureDisabled && <div className={cn('absolute -top-5 z-10 flex max-w-full items-center gap-1 rounded-full border border-border bg-card p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-[640px]:static max-[640px]:border-transparent max-[640px]:bg-transparent max-[640px]:p-0 max-[640px]:opacity-100 max-[640px]:shadow-none', isMine ? 'right-0' : 'left-0', openMenuMsgId === msg.id && 'opacity-100', dismissedHoverMsgId === msg.id && 'invisible')}>
      {!isRecalled && conversation.canSend && <>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Bày tỏ cảm xúc" aria-label="Bày tỏ cảm xúc">
              <SmilePlus aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" aria-label="Bày tỏ cảm xúc" onCloseAutoFocus={e => e.preventDefault()} className="grid w-auto grid-cols-3 gap-1 p-2">{REACTION_META.map(meta => <PopoverClose key={meta.type} asChild>
            <Button type="button" variant="ghost" size="icon" title={meta.label} aria-label={meta.label} onMouseDown={e => e.preventDefault()} onClick={e => { e.currentTarget.blur(); setDismissedHoverMsgId(msg.id); onReact(msg, meta.type); }}>{meta.emoji}</Button>
          </PopoverClose>)}</PopoverContent>
        </Popover>
        <Button type="button" variant="ghost" size="icon" title="Trả lời tin nhắn" aria-label="Trả lời tin nhắn" onMouseDown={e => e.preventDefault()} onClick={e => { e.currentTarget.blur(); setDismissedHoverMsgId(msg.id); onReply(msg); }}>
          <Reply aria-hidden="true" />
        </Button>
      </>}
      <div onMouseDown={e => e.stopPropagation()}>
        <DropdownMenu open={openMenuMsgId === msg.id} onOpenChange={open => setOpenMenuMsgId(open ? msg.id : null)}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Tùy chọn tin nhắn" aria-label="Tùy chọn tin nhắn">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isMine ? 'end' : 'start'} className="z-1000" onMouseDown={e => e.stopPropagation()}>{canEditMsg && <DropdownMenuItem onSelect={() => onEdit(msg)}>
            <Pencil aria-hidden="true" />Chỉnh sửa</DropdownMenuItem>}{canRecallMsg && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onRecall(msg)}>
              <Trash2 aria-hidden="true" />Thu hồi</DropdownMenuItem>}<DropdownMenuItem onSelect={() => onHide(msg)}>
              <EyeOff aria-hidden="true" />Ẩn ở phía tôi</DropdownMenuItem>{!isMine && !isRecalled && <DropdownMenuItem onSelect={() => onReport(msg)}>
              <Flag aria-hidden="true" />Báo cáo tin nhắn</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>}
    {!isRecalled && msg.reactions.length > 0 && <div className="flex flex-wrap gap-1">{msg.reactions.map(r => {
      const meta = REACTION_META.find(m => m.type === r.type); return <Button type="button" key={r.type} size="default" variant={r.reactedByMe ? 'brand' : 'outline'} className="h-11 rounded-full px-3" onClick={() => onReact(msg, r.type)}>
        <span>{meta?.emoji || r.type}</span>
        <span>{r.count}</span>
      </Button>;
    })}</div>}
  </div>;
}
