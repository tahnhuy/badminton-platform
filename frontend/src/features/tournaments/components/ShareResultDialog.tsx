import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { TournamentDetail } from '../types';

/** Share the result to the Social feed (PRD FR-71, Tech Design §7.7). */
export function ShareResultDialog({ tournament: t, onClose }: { tournament: TournamentDetail; onClose: () => void }) {
  const navigate = useNavigate();
  const [body, setBody] = useState('');
  const share = useTournamentMutation(t.id, (text: string) => tournamentApi.share(t.id, text), 'Đã chia sẻ lên Cộng đồng!');
  return <Dialog open onOpenChange={open => { if (!open && !share.isPending) onClose(); }}>
    <DialogContent closeDisabled={share.isPending}>
      <DialogTitle>Chia sẻ kết quả giải</DialogTitle>
      <DialogDescription className="mt-2">Bài viết kèm thẻ kết quả ({t.name}) xuất hiện trên Cộng đồng. Mỗi người chia sẻ một lần.</DialogDescription>
      <Textarea aria-label="Lời chia sẻ" className="mt-4 min-h-32" maxLength={2000} value={body} onChange={e => setBody(e.target.value)} placeholder="Cảm nghĩ của bạn về giải đấu (không bắt buộc)" />
      <p className="mt-1 text-right text-xs text-muted-foreground">{[...body].length}/2000</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onClose} disabled={share.isPending}>Huỷ</Button>
        <Button type="button" variant="brand" className="h-11" disabled={share.isPending}
          onClick={() => share.mutate(body, { onSuccess: r => { onClose(); navigate(`/posts/${r.postId}`); } })}>
          {share.isPending ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Share2 aria-hidden="true" />}Chia sẻ
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
