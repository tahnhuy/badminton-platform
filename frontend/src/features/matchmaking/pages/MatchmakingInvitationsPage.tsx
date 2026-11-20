import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { InvitationList } from '../components/InvitationList';

export function MatchmakingInvitationsPage() {
  const [direction, setDirection] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
  const [version, setVersion] = useState(0);
  return <PageContainer className="max-w-250">
    <PageHeader title="Lời mời chơi" description="Lời mời bạn nhận được và đã gửi cho các kèo." actions={<Button asChild variant="outline" className="h-11"><Link to="/matchmaking"><ArrowLeft aria-hidden="true" />Ghép trận</Link></Button>} />
    <div role="group" aria-label="Hướng lời mời" className="flex w-fit gap-1 rounded-full bg-muted p-1">
      {(['RECEIVED', 'SENT'] as const).map(key => <button key={key} type="button" aria-pressed={direction === key} onClick={() => setDirection(key)}
        className={cn('min-h-11 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', direction === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card hover:text-foreground')}>{key === 'RECEIVED' ? 'Đã nhận' : 'Đã gửi'}</button>)}
    </div>
    <InvitationList key={direction} direction={direction} refreshToken={version} onChanged={() => setVersion(v => v + 1)} />
  </PageContainer>;
}
