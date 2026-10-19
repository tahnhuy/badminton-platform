import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/auth-context';
import type { MatchDetail } from '../../types/matchmaking';
import { StatusPill } from '../StateBlocks';
import { matchDate, matchTimeRange, matchStatusDescriptions } from '../../utils/matchDetail';

export function MatchHero({ match }: { match: MatchDetail }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`#${match.id}`); setCopied('Đã sao chép mã trận.'); }
    catch { setCopied('Không thể sao chép. Bạn có thể chọn mã trận để sao chép thủ công.'); }
  };
  return <header className={`match-hero match-state-${match.status.toLowerCase()}`}>
    <div className="match-hero-top"><StatusPill status={match.status} /><span className="match-eyebrow">GIAO LƯU · {match.matchType === 'SINGLES' ? 'ĐẤU ĐƠN' : 'ĐẤU ĐÔI'}</span></div>
    <div className="match-hero-title"><div><h1>Chi tiết trận {match.matchType === 'SINGLES' ? 'đấu đơn' : 'đấu đôi'}</h1><p>{matchStatusDescriptions[match.status]}</p></div>
      <div className="match-code"><span>MÃ TRẬN ĐẤU</span><strong>#{match.id}</strong><button type="button" onClick={() => void copy()}>Sao chép</button>{copied && <small role="status">{copied}</small>}</div>
    </div>
    <div className="match-hero-meta"><span>{matchDate(match.scheduledAt)}</span><span>{matchTimeRange(match)}</span><span>{match.currentPlayers}/{match.requiredPlayers} người</span></div>
  </header>;
}

export function MatchSchedule({ match }: { match: MatchDetail }) {
  const address = match.facility ? [match.facility.address, match.facility.ward, match.facility.district, match.facility.city].filter(Boolean).join(', ') : null;
  return <section className="match-panel" aria-labelledby="match-schedule-title">
    <div className="match-panel-heading"><h2 id="match-schedule-title">Sân thi đấu & lịch trình</h2><span className="match-label">{match.court ? 'Đã có sân' : 'Chưa có sân'}</span></div>
    <div className="match-facts"><div><span>NGÀY CHƠI</span><strong>{matchDate(match.scheduledAt)}</strong></div><div><span>KHUNG GIỜ</span><strong>{matchTimeRange(match)}</strong></div></div>
    {match.facility ? <div className="match-venue"><span className="match-venue-icon" aria-hidden="true">⌖</span><div><h3>{match.court?.name ?? 'Sân chưa xác định'}</h3><Link to={`/facilities/${match.facility.id}`}>{match.facility.name}</Link><p>{address}</p></div></div>
      : <p className="match-note">Lịch hiện tại là dự kiến. Thông tin sân và khung giờ chính thức sẽ hiển thị sau khi booking được liên kết.</p>}
  </section>;
}

export function MatchTeams({ match }: { match: MatchDetail }) {
  const { user } = useAuth();
  return <section className="match-panel" aria-labelledby="match-teams-title">
    <div className="match-panel-heading"><h2 id="match-teams-title">Đội hình thi đấu</h2><span className="match-muted">{match.currentPlayers}/{match.requiredPlayers} người</span></div>
    <div className="match-teams">{[1, 2].map(team => <div className={`match-team match-team-${team}`} key={team}>
      <h3><span className="match-team-dot" />Đội {team === 1 ? 'A' : 'B'}</h3>
      <ul>{match.players.filter(player => player.teamNo === team).map(player => <li key={player.playerId} className={player.status === 'LEFT' ? 'match-player-left' : ''}>
        <span className="match-avatar" aria-hidden="true">{(player.displayName?.trim() || '?').slice(0, 1).toUpperCase()}</span>
        <div><strong>{player.displayName ?? 'Người chơi'} {player.playerId === user?.id && <span className="match-you">Bạn</span>}</strong><p>{player.skill?.name ?? 'Chưa xác định trình độ'}</p>{player.status === 'LEFT' && <span className="match-left-label">Đã rời</span>}</div>
      </li>)}</ul>
      {!match.players.some(player => player.teamNo === team) && <p className="match-muted">Chưa có thông tin người chơi.</p>}
    </div>)}</div>
  </section>;
}

export function MatchCost({ match }: { match: MatchDetail }) {
  const payer = match.players.find(player => player.playerId === match.payer?.playerId);
  return <section className="match-panel" aria-labelledby="match-cost-title">
    <h2 id="match-cost-title">Chi phí & booking</h2><div className="match-price"><span>Tổng tiền sân</span><strong>{match.price === null ? 'Chưa có thông tin' : `${match.price.toLocaleString('vi-VN')} ₫`}</strong></div>
    <p className="match-muted">Người thanh toán: {match.payer ? payer?.displayName ?? 'Chưa có tên người thanh toán' : 'Chưa có thông tin'}</p>
    <p className="match-note">Chủ kèo thanh toán toàn bộ booking sân. Hệ thống không chia tiền theo từng người chơi.</p>
    {match.isOwner && match.booking && <Link className="match-button match-button-secondary" to={`/bookings/${match.booking.id}`}>Xem booking sân</Link>}
    {match.status === 'CANCELLED' && match.isOwner && match.booking && <p className="match-muted">Theo dõi việc hủy booking và hoàn tiền tại chi tiết booking. Hủy trận không đồng nghĩa tiền đã được hoàn.</p>}
  </section>;
}
