import { Link } from 'react-router-dom';
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

function ContentFlags({ hiddenAt, deletedAt }: { hiddenAt: string | null; deletedAt: string | null }) {
  if (!hiddenAt && !deletedAt) return null;
  return (
    <>
      {hiddenAt && <span className="report-target-flag hidden">Đã ẩn</span>}
      {deletedAt && <span className="report-target-flag deleted">Đã xóa</span>}
    </>
  );
}

function UserLine({ user }: { user: TargetUserSummary }) {
  return (
    <span className="report-target-sub">
      {user.displayName} · #{user.id} · {statusLabel(user.status)}
    </span>
  );
}

function ReportHistory({ history }: { history: TargetReportHistory }) {
  return (
    <div className="report-target-block">
      <h4>Tín hiệu kiểm duyệt</h4>
      <div className="report-target-risk">
        <div><span>Tổng báo cáo</span><strong>{history.total}</strong></div>
        <div><span>Đang mở</span><strong>{history.open}</strong></div>
        <div><span>30 ngày</span><strong>{history.last30Days}</strong></div>
        <div><span>Người báo khác nhau</span><strong>{history.distinctReporters}</strong></div>
      </div>

      {history.byReason.length > 0 && (
        <p className="report-target-reasons">
          Lý do: {history.byReason.map(item => `${reasonLabel(item.reasonCode)} (${item.count})`).join(' · ')}
        </p>
      )}

      <h4>Báo cáo gần đây</h4>
      {history.recent.length === 0 ? (
        <p className="report-target-empty">Chưa có dữ liệu.</p>
      ) : (
        <ul className="report-target-list">
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
      <div className="report-target-identity">
        {player.avatarUrl
          ? <img className="report-target-avatar" src={player.avatarUrl} alt="" />
          : <span className="report-target-avatar report-target-avatar-fallback">{initial}</span>}
        <div>
          <strong className="report-target-name">{player.displayName}</strong>{' '}
          <span className="report-admin-pill">{statusLabel(player.status)}</span>
          <p className="report-target-sub">
            {player.email}{player.phone ? ` · ${player.phone}` : ''}
          </p>
          <p className="report-target-sub">
            Tham gia {formatDateTime(player.joinedAt)} · Trình độ: {player.skillLevel?.name ?? 'Chưa cập nhật'}
          </p>
        </div>
      </div>

      <Link className="social-button report-target-link" to={`/admin/users?userId=${player.id}`}>
        Mở hồ sơ người dùng
      </Link>
      <p className="report-target-note">
        Báo cáo cấp tài khoản: xác minh dựa trên mô tả người báo, lịch sử báo cáo và hoạt động công khai.
        Không có snapshot nội dung cho đối tượng người chơi.
      </p>

      <ReportHistory history={target.reportHistory} />

      <div className="report-target-block">
        <h4>Hoạt động công khai gần đây</h4>
        <p className="report-target-sub">
          Nội dung bị ẩn: {recentContent.hiddenPostCount} bài viết · {recentContent.hiddenCommentCount} bình luận
        </p>

        <h5>Bài viết</h5>
        {recentContent.posts.length === 0 ? (
          <p className="report-target-empty">Chưa có dữ liệu.</p>
        ) : (
          <ul className="report-target-list">
            {recentContent.posts.map(post => (
              <li key={post.id}>
                <strong>#{post.id}</strong> · {post.excerpt || 'Không có nội dung'} · {formatDateTime(post.createdAt)}{' '}
                <ContentFlags hiddenAt={post.hiddenAt} deletedAt={post.deletedAt} />
              </li>
            ))}
          </ul>
        )}

        <h5>Bình luận</h5>
        {recentContent.comments.length === 0 ? (
          <p className="report-target-empty">Chưa có dữ liệu.</p>
        ) : (
          <ul className="report-target-list">
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
      <div className="report-target-block">
        <h4>Bài viết hiện tại</h4>
        {(post.hiddenAt || post.deletedAt) && (
          <p><ContentFlags hiddenAt={post.hiddenAt} deletedAt={post.deletedAt} /></p>
        )}
        {post.title && <p><strong>{post.title}</strong></p>}
        <p className="report-target-body">{post.body || 'Không có nội dung.'}</p>
        <p><UserLine user={post.author} /></p>
        <dl className="report-admin-meta">
          <dt>Loại</dt><dd>{post.type}</dd>
          <dt>Tạo lúc</dt><dd>{formatDateTime(post.createdAt)}</dd>
          <dt>Xuất bản</dt><dd>{formatDateTime(post.publishedAt)}</dd>
          <dt>Chỉnh sửa</dt><dd>{formatDateTime(post.editedAt)}</dd>
          <dt>Ẩn bởi</dt><dd>{post.hiddenBy ? `#${post.hiddenBy}` : '—'}</dd>
        </dl>
      </div>
      <ReportHistory history={target.reportHistory} />
    </>
  );
}

function CommentTarget({ target }: { target: Extract<AdminReportTarget, { type: 'COMMENT' }> }) {
  const { comment, post } = target;
  return (
    <>
      <div className="report-target-block">
        <h4>Bình luận hiện tại</h4>
        {(comment.hiddenAt || comment.deletedAt) && (
          <p><ContentFlags hiddenAt={comment.hiddenAt} deletedAt={comment.deletedAt} /></p>
        )}
        <p className="report-target-body">{comment.body}</p>
        <p><UserLine user={comment.author} /></p>
        <p className="report-target-sub">Tạo lúc {formatDateTime(comment.createdAt)}</p>
      </div>

      <div className="report-target-block">
        <h4>Bài viết cha</h4>
        {post ? (
          <>
            {post.title && <p><strong>{post.title}</strong></p>}
            <p className="report-target-body">{post.bodyExcerpt || 'Không có nội dung.'}</p>
            <p><UserLine user={post.author} /></p>
            {(post.hiddenAt || post.deletedAt) && (
              <p><ContentFlags hiddenAt={post.hiddenAt} deletedAt={post.deletedAt} /></p>
            )}
          </>
        ) : (
          <p className="report-target-empty">Bài viết cha không còn tồn tại.</p>
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
      <div className="report-target-block">
        <h4>Tin nhắn được báo cáo</h4>
        <p className="report-target-sub">
          {message.sender.displayName} · #{message.sender.id} · {formatDateTime(message.createdAt)}
        </p>
        <p className="report-target-body">{message.body || 'Không có nội dung.'}</p>
        <ContentFlags hiddenAt={null} deletedAt={message.deletedAt} />
        <p className="report-target-note">
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
      <div className="report-target-block">
        <h4>Thông tin cơ sở</h4>
        <dl className="report-admin-meta">
          <dt>Tên</dt><dd>{facility.name}</dd>
          <dt>Mã</dt><dd>{facility.facilityCode}</dd>
          <dt>Địa chỉ</dt><dd>{[facility.address, facility.ward, facility.district, facility.city].filter(Boolean).join(', ')}</dd>
          <dt>Điện thoại</dt><dd>{facility.phone}</dd>
          <dt>Trạng thái</dt><dd>{statusLabel(facility.status)}</dd>
          <dt>Giờ mở cửa</dt><dd>{facility.openingTime} – {facility.closingTime}</dd>
          <dt>Số sân</dt><dd>{facility.courtCount}</dd>
          <dt>Chủ sân</dt><dd>{facility.owner.name} · #{facility.owner.id} · {facility.owner.email} · {facility.owner.phone}</dd>
          <dt>Mô tả</dt><dd>{facility.description || '—'}</dd>
        </dl>
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
      <div className="report-target-block">
        <h4>Thông tin giải đấu</h4>
        <dl className="report-admin-meta">
          <dt>Tên</dt><dd>{tournament.name}</dd>
          <dt>Trạng thái</dt><dd>{statusLabel(tournament.status)}</dd>
          <dt>Thể thức</dt><dd>{tournament.format} · {tournament.matchType}</dd>
          <dt>Số người</dt><dd>{tournament.participantLimit}</dd>
          <dt>Lệ phí</dt><dd>{tournament.entryFee}</dd>
          <dt>Đăng ký</dt><dd>{formatDateTime(tournament.registrationStart)} – {formatDateTime(tournament.registrationEnd)}</dd>
          <dt>Thi đấu</dt><dd>{formatDateTime(tournament.tournamentStart)} – {formatDateTime(tournament.tournamentEnd)}</dd>
          <dt>Người tạo</dt><dd>{tournament.creator.displayName} · #{tournament.creator.id}</dd>
          <dt>Cơ sở</dt><dd>{tournament.facility ? `${tournament.facility.name} · #${tournament.facility.id}` : '—'}</dd>
          <dt>Mô tả</dt><dd>{tournament.description || '—'}</dd>
        </dl>
        {tournament.deletedAt && <ContentFlags hiddenAt={null} deletedAt={tournament.deletedAt} />}
      </div>
      <ReportHistory history={target.reportHistory} />
    </>
  );
}

export function ReportTargetPanel({ target }: { target: AdminReportTarget }) {
  return (
    <section className="report-admin-card report-target-card">
      <div className="report-target-header">
        <h3>Đối tượng bị báo cáo</h3>
        <span className="report-admin-pill">{TARGET_TYPE_LABELS[target.type]}</span>
      </div>

      {!target.available && (
        <>
          <p className="report-target-note">
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
