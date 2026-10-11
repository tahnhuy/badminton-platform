import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InvitationList } from '../components/InvitationList';
export function MatchmakingInvitationsPage() {
  const [direction, setDirection] = useState<'RECEIVED' | 'SENT'>('RECEIVED');
  const [version, setVersion] = useState(0);
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 24 }}>
    <Link to="/matchmaking">← Ghép trận</Link><h1>Lời mời chơi</h1>
    <button onClick={() => setDirection('RECEIVED')} aria-pressed={direction === 'RECEIVED'}>Đã nhận</button>
    <button onClick={() => setDirection('SENT')} aria-pressed={direction === 'SENT'}>Đã gửi</button>
    <InvitationList key={direction} direction={direction} refreshToken={version} onChanged={() => setVersion(v => v + 1)} />
  </main>;
}
