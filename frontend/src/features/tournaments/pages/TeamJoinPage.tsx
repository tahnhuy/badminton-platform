import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Link2Off, LoaderCircle, Users } from 'lucide-react';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { PageContainer } from '@/components/common/page-layout';
import { feeLabel, formatDateTime, JOIN_REASON } from '../format';
import { useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import { Notice, PlayerAvatar } from '../components/shared';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** `/tournaments/join/:token` — join a Doubles team by invite link (Tech Design §3.2, TRN-09). */
export function TeamJoinPage() {
  const token = useParams().token ?? '';
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const preview = useQuery({ queryKey: ['tournaments', 'join', token], queryFn: () => tournamentApi.joinPreview(token), retry: false });
  const tournamentId = preview.data?.tournament.id ?? null;
  const join = useTournamentMutation(tournamentId, () => tournamentApi.join(token), r => `Bạn đã vào đội ${r.name}!`);

  return <LazyMotion features={domAnimation} strict>
    <PageContainer className="items-center">
      {preview.isPending ? <Skeleton className="h-80 w-full max-w-lg rounded-panel" />
        : preview.isError || !preview.data ? <div className="w-full max-w-lg"><EmptyState icon={Link2Off} title="Link mời không còn hiệu lực" role="alert"
          description="Link có thể đã được tạo lại, đội đã đủ người hoặc giải đã đóng đăng ký. Hãy xin đội trưởng link mới." action={{ label: 'Xem các giải đấu', onClick: () => navigate('/tournaments') }} /></div>
          : <m.section initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: EASE }}
            className="relative w-full max-w-lg overflow-hidden rounded-panel bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep p-6 text-primary-foreground shadow-panel sm:p-8">
            <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand-lime/25 blur-3xl motion-safe:animate-drift" />
            <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-mint"><Users aria-hidden="true" className="size-4" />Lời mời vào đội</p>
            <h1 className="relative mt-2 text-3xl font-extrabold tracking-tight">{preview.data.team.name}</h1>
            <div className="relative mt-4 flex items-center gap-3">
              <PlayerAvatar player={preview.data.team.captain} size="lg" className="ring-2 ring-brand-lime" />
              <p className="text-sm"><span className="text-brand-mint">Đội trưởng</span><br /><b className="text-base">{preview.data.team.captain.fullName}</b></p>
            </div>
            <div className="relative mt-5 rounded-2xl bg-primary-foreground/10 p-4 text-sm">
              <Link to={`/tournaments/${preview.data.tournament.id}`} className="font-bold underline-offset-4 hover:underline">{preview.data.tournament.name}</Link>
              <p className="mt-1 flex items-center gap-1.5 text-brand-mint"><CalendarDays aria-hidden="true" className="size-4" />{formatDateTime(preview.data.tournament.tournamentStart)}</p>
              <p className="mt-1 text-brand-mint">Lệ phí {feeLabel(preview.data.tournament.entryFee)} — đội trưởng trả khi đăng ký.</p>
            </div>
            {preview.data.canJoin
              ? <Button type="button" className="relative mt-6 h-12 w-full overflow-hidden bg-brand-lime text-base text-brand-forest hover:bg-brand-lime-deep" disabled={join.isPending}
                onClick={() => join.mutate(undefined, { onSuccess: () => navigate(`/tournaments/${preview.data!.tournament.id}`) })}>
                <span aria-hidden="true" className="absolute inset-y-0 -left-1/2 w-1/3 bg-primary-foreground/40 motion-safe:animate-shine" />
                <span className="relative flex items-center gap-2">{join.isPending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}Vào đội</span>
              </Button>
              : <Notice tone="caution" className="relative mt-6">{JOIN_REASON[preview.data.reason ?? ''] ?? 'Không thể vào đội này.'}</Notice>}
          </m.section>}
    </PageContainer>
  </LazyMotion>;
}
