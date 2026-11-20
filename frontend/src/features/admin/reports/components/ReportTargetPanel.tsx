import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  REASON_LABELS,
  TARGET_TYPE_LABELS,
  type AdminReportTarget,
  type TargetReportHistory,
  type TargetUserSummary,
} from '../types/report';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  SUSPENDED: 'Tạm khóa',
  DEACTIVATED: 'Đã vô hiệu hóa',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { hour12: false });
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function reasonLabel(reasonCode: string): string {
  return REASON_LABELS[reasonCode] ?? reasonCode;
}

function MetaList({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)]">
    {rows.map(row => <div key={row.label} className="contents">
      <dt className="text-muted-foreground">{row.label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{row.value}</dd>
    </div>)}
  </dl>;
}

function ContentFlags({ hiddenAt, deletedAt }: { hiddenAt: string | null; deletedAt: string | null }) {
  if (!hiddenAt && !deletedAt) return null;
  return (
    <>
      {hiddenAt && <Badge className="ml-1.5 bg-info-bg text-info">Đã ẩn</Badge>}
      {deletedAt && <Badge className="ml-1.5 bg-danger-bg text-danger">Đã xóa</Badge>}
    </>
  );
}

function UserLine({ user }: { user: TargetUserSummary }) {
  return (
    <span className="text-xs text-muted-foreground">
      {user.displayName} · #{user.id} · {statusLabel(user.status)}
    </span>
  );
}

function ReportHistory({ history }: { history: TargetReportHistory }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <h4 className="text-sm font-bold">Tín hiệu kiểm duyệt</h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Tổng báo cáo', history.total],
          ['Đang mở', history.open],
          ['30 ngày', history.last30Days],
          ['Người báo khác nhau', history.distinctReporters],
        ].map(([label, value]) => <div key={label} className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <span className="text-2xs text-muted-foreground">{label}</span>
          <strong className="text-lg font-extrabold tabular-nums">{value}</strong>
        </div>)}
      </div>

      {history.byReason.length > 0 && <p className="text-xs">
        Lý do: {history.byReason.map(item => `${reasonLabel(item.reasonCode)} (${item.count})`).join(' · ')}
      </p>}

      <h4 className="mt-1 text-sm font-bold">Báo cáo gần đây</h4>
      {history.recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
          {history.recent.map(item => (
            <li key={item.id}>
              <strong>#{item.id}</strong> · Người báo #{item.reporterId} · {reasonLabel(item.reasonCode)} ·{' '}
              {item.status === 'OPEN' ? 'Chờ xử lý' : 'Đã xử lý'} · {formatDateTime(item.createdAt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerTarget({ target }: { target: Extract<AdminReportTarget, { type: 'PLAYER' }> }) {
  const { player, recentContent } = target;
  const initial = player.displayName.trim().charAt(0).toUpperCase() || '?';
  return (
    <>
      <div className="flex items-center gap-3">
        {player.avatarUrl
          ? <img className="size-12 shrink-0 rounded-full border border-border bg-muted object-cover" src={player.avatarUrl} alt="" />
          : <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-extrabold text-primary">{initial}</span>}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm font-bold">{player.displayName}</strong>
            <Badge>{statusLabel(player.status)}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {player.email}{player.phone ? ` · ${player.phone}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            Tham gia {formatDateTime(player.joinedAt)} · Trình độ: {player.skillLevel?.name ?? 'Chưa cập nhật'}
          </p>
        </div>
      </div>

      <Button asChild variant="outline" className="self-start">
        <Link to={`/admin/users?userId=${player.id}`}>Mở hồ sơ người dùng</Link>
      </Button>
      <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
        Báo cáo cấp tài khoản: xác minh dựa trên mô tả người báo, lịch sử báo cáo và hoạt động công khai.
        Không có snapshot nội dung cho đối tượng người chơi.
      </p>

      <ReportHistory history={target.reportHistory} />

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-sm font-bold">Hoạt động công khai gần đây</h4>
        <p className="text-xs text-muted-foreground">
          Nội dung bị ẩn: {recentContent.hiddenPostCount} bài viết · {recentContent.hiddenCommentCount} bình luận
        </p>

        <h5 className="text-xs font-semibold text-muted-foreground">Bài viết</h5>
        {recentContent.posts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
            {recentContent.posts.map(post => (
              <li key={post.id}>
                <strong>#{post.id}</strong> · {post.excerpt || 'Không có nội dung'} · {formatDateTime(post.createdAt)}{' '}
                <ContentFlags hiddenAt={post.hiddenAt} deletedAt={post.deletedAt} />
              </li>
            ))}
          </ul>
        )}

        <h5 className="text-xs font-semibold text-muted-foreground">Bình luận</h5>
        {recentContent.comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
            {recentContent.comments.map(comment => (
              <li key={comment.id}>
                <strong>#{comment.id}</strong> trong bài #{comment.postId} · {comment.excerpt || 'Không có nội dung'} ·{' '}
                {formatDateTime(comment.createdAt)} <ContentFlags hiddenAt={comment.hiddenAt} deletedAt={comment.deletedAt} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function PostTarget({ target }: { target: Extract<AdminReportTarget, { type: 'POST' }> }) {
  const { post } = target;
  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-sm font-bold">Bài viết hiện tại</h4>
        {(post.hiddenAt || post.deletedAt) && <p><ContentFlags hiddenAt={post.hiddenAt} deletedAt={post.deletedAt} /></p>}
        {post.title && <p className="font-semibold">{post.title}</p>}
        <p className="whitespace-pre-wrap text-sm leading-6">{post.body || 'Không có nội dung.'}</p>
        <p><UserLine user={post.author} /></p>
        <MetaList rows={[
          { label: 'Loại', value: post.type },
          { label: 'Tạo lúc', value: formatDateTime(post.createdAt) },
          { label: 'Xuất bản', value: formatDateTime(post.publishedAt) },
          { label: 'Chỉnh sửa', value: formatDateTime(post.editedAt) },
          { label: 'Ẩn bởi', value: post.hiddenBy ? `#${post.hiddenBy}` : '—' },
        ]} />
      </div>
      <ReportHistory history={target.reportHistory} />
    </>
  );
}

function CommentTarget({ target }: { target: Extract<AdminReportTarget, { type: 'COMMENT' }> }) {
  const { comment, post } = target;
  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-sm font-bold">Bình luận hiện tại</h4>
        {(comment.hiddenAt || comment.deletedAt) && <p><ContentFlags hiddenAt={comment.hiddenAt} deletedAt={comment.deletedAt} /></p>}
        <p className="whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
        <p><UserLine user={comment.author} /></p>
        <p className="text-xs text-muted-foreground">Tạo lúc {formatDateTime(comment.createdAt)}</p>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-sm font-bold">Bài viết cha</h4>
        {post ? (
          <>
            {post.title && <p className="font-semibold">{post.title}</p>}
            <p className="whitespace-pre-wrap text-sm leading-6">{post.bodyExcerpt || 'Không có nội dung.'}</p>
            <p><UserLine user={post.author} /></p>
            {(post.hiddenAt || post.deletedAt) && <p><ContentFlags hiddenAt={post.hiddenAt} deletedAt={post.deletedAt} /></p>}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Bài viết cha không còn tồn tại.</p>
        )}
      </div>
      <ReportHistory history={target.reportHistory} />
    </>
  );
}

function MessageTarget({ target }: { target: Extract<AdminReportTarget, { type: 'MESSAGE' }> }) {
  const { message } = target;
  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-sm font-bold">Tin nhắn được báo cáo</h4>
        <p className="text-xs text-muted-foreground">
          {message.sender.displayName} · #{message.sender.id} · {formatDateTime(message.createdAt)}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-6">{message.body || 'Không có nội dung.'}</p>
        <ContentFlags hiddenAt={null} deletedAt={message.deletedAt} />
        <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
          Chỉ hiển thị nội dung đã được chụp làm bằng chứng. Không mở hội thoại hoặc tin nhắn xung quanh.
        </p>
      </div>
      <ReportHistory history={target.reportHistory} />
    </>
  );
}

function FacilityTarget({ target }: { target: Extract<AdminReportTarget, { type: 'FACILITY' }> }) {
  const { facility } = target;
  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-sm font-bold">Thông tin cơ sở</h4>
        <MetaList rows={[
          { label: 'Tên', value: facility.name },
          { label: 'Mã', value: facility.facilityCode },
          { label: 'Địa chỉ', value: [facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ') },
          { label: 'Điện thoại', value: facility.phone },
          { label: 'Trạng thái', value: statusLabel(facility.status) },
          { label: 'Giờ mở cửa', value: `${facility.openingTime} – ${facility.closingTime}` },
          { label: 'Số sân', value: facility.courtCount },
          { label: 'Chủ sân', value: `${facility.owner.name} · #${facility.owner.id} · ${facility.owner.email} · ${facility.owner.phone}` },
          { label: 'Mô tả', value: facility.description || '—' },
        ]} />
        {facility.deletedAt && <ContentFlags hiddenAt={null} deletedAt={facility.deletedAt} />}
      </div>
      <ReportHistory history={target.reportHistory} />
    </>
  );
}

function TournamentTarget({ target }: { target: Extract<AdminReportTarget, { type: 'TOURNAMENT' }> }) {
  const { tournament } = target;
  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-sm font-bold">Thông tin giải đấu</h4>
        <MetaList rows={[
          { label: 'Tên', value: tournament.name },
          { label: 'Trạng thái', value: statusLabel(tournament.status) },
          { label: 'Thể thức', value: `${tournament.format} · ${tournament.matchType}` },
          { label: 'Số người', value: tournament.participantLimit },
          { label: 'Lệ phí', value: tournament.entryFee },
          { label: 'Đăng ký', value: `${formatDateTime(tournament.registrationStart)} – ${formatDateTime(tournament.registrationEnd)}` },
          { label: 'Thi đấu', value: `${formatDateTime(tournament.tournamentStart)} – ${formatDateTime(tournament.tournamentEnd)}` },
          { label: 'Người tạo', value: `${tournament.creator.displayName} · #${tournament.creator.id}` },
          { label: 'Cơ sở', value: tournament.facility ? `${tournament.facility.name} · #${tournament.facility.id}` : '—' },
          { label: 'Mô tả', value: tournament.description || '—' },
        ]} />
        {tournament.deletedAt && <ContentFlags hiddenAt={null} deletedAt={tournament.deletedAt} />}
      </div>
      <ReportHistory history={target.reportHistory} />
    </>
  );
}

export function ReportTargetPanel({ target }: { target: AdminReportTarget }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold">Đối tượng bị báo cáo</h3>
        <Badge>{TARGET_TYPE_LABELS[target.type]}</Badge>
      </div>

      {!target.available && (
        <>
          <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
            Đối tượng không còn tồn tại hoặc đã bị xóa. Lịch sử báo cáo vẫn được hiển thị bên dưới.
          </p>
          <ReportHistory history={target.reportHistory} />
        </>
      )}

      {target.available && target.type === 'PLAYER' && <PlayerTarget target={target} />}
      {target.available && target.type === 'POST' && <PostTarget target={target} />}
      {target.available && target.type === 'COMMENT' && <CommentTarget target={target} />}
      {target.available && target.type === 'MESSAGE' && <MessageTarget target={target} />}
      {target.available && target.type === 'FACILITY' && <FacilityTarget target={target} />}
      {target.available && target.type === 'TOURNAMENT' && <TournamentTarget target={target} />}
    </section>
  );
}
