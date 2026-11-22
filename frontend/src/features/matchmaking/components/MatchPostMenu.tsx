import { useRef, useState } from 'react';
import { Ellipsis, Flag, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ReportDialog } from '../../../components/common/ReportDialog';
import { useBeforeInstant } from '../../../shared/hooks/useBeforeInstant';
import { Notice } from '../../social/components/SocialUi';
import { PostComposer } from '../../social/components/PostComposer';
import { socialApi } from '../../social/api';
import type { PostCard } from '../../social/types';
import type { SkillLevel } from '../types/matchmaking';
import { socialError } from '../../social/utils';

/**
 * Author edit/delete and report for match-finding posts. Kept separate from the share
 * card so no social interaction is ever rendered inside a recruitment card.
 */
export function MatchPostMenu({ post, skills, onChanged, onDeleted }: { post: PostCard; skills: SkillLevel[]; onChanged: (post: PostCard) => void; onDeleted: (id: number) => void }) {
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false); const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const pending = useRef(false);
  const nextAction = useRef<'edit' | 'delete' | 'report' | null>(null); const menuTrigger = useRef<HTMLButtonElement>(null);
  const beforeStart = useBeforeInstant(post.recruitment?.startAt);
  const recruitment = post.recruitment;
  const startedActive = recruitment && !['CANCELLED', 'EXPIRED'].includes(recruitment.status) && !beforeStart;
  const remove = async () => {
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try { await socialApi.delete(post.id); onDeleted(post.id); }
    catch (reason) { setError(socialError(reason)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger ref={menuTrigger} asChild><Button type="button" variant="ghost" size="icon" className="rounded-full" aria-label="Thao tác bài đăng"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-58" onCloseAutoFocus={() => {
        const action = nextAction.current; nextAction.current = null;
        if (action === 'edit') setEditing(true); else if (action === 'delete') setDeleting(true); else if (action === 'report') setReporting(true);
      }}>
        {post.isAuthor ? <>
          <DropdownMenuItem disabled={busy} onSelect={() => { nextAction.current = 'edit'; }}><Pencil aria-hidden="true" />Chỉnh sửa kèo</DropdownMenuItem>
          <DropdownMenuItem disabled={busy} className="text-danger focus:bg-danger-bg focus:text-danger" onSelect={() => { nextAction.current = 'delete'; }}><Trash2 aria-hidden="true" />Xóa bài kèo</DropdownMenuItem>
        </> : <DropdownMenuItem disabled={busy} onSelect={() => { nextAction.current = 'report'; }}><Flag aria-hidden="true" />Báo cáo bài kèo</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    {editing && <PostComposer post={post} type="MATCH_FINDING" skills={skills} onClose={() => setEditing(false)} onSaved={saved => { onChanged(saved); setEditing(false); }} />}
    <Dialog open={deleting} onOpenChange={open => { if (!open && !busy) setDeleting(false); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); menuTrigger.current?.focus(); }}>
        <DialogTitle>Xóa bài tìm kèo?</DialogTitle>
        <DialogDescription className="mt-3 leading-6">{startedActive ? 'Chỉ xóa được khi kèo đã kết thúc. Kèo đang diễn ra không thể xóa. Booking được giữ nguyên.' : 'Xóa bài đang hoạt động sẽ hủy kèo và đóng các lời mời đang chờ. Thành viên bị ảnh hưởng sẽ được thông báo. Booking được giữ nguyên; bạn tự quản lý booking riêng.'}</DialogDescription>
        {error && <div className="mt-4"><Notice error>{error}</Notice></div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => setDeleting(false)}>Giữ bài kèo</Button>
          <Button type="button" className="h-11 bg-danger text-primary-foreground hover:bg-danger-hover" disabled={busy} onClick={() => void remove()}>{busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button>
        </div>
      </DialogContent>
    </Dialog>
    {reporting && <ReportDialog targetType="POST" targetId={post.id} onClose={() => setReporting(false)} />}
  </>;
}
