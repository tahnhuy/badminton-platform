import { financeDate, financeLabel } from './finance-labels';

const FIELD_LABELS: Record<string, string> = {
  settlementId: 'Mã quyết toán', autoCreditEnabled: 'Tự động cộng ví', total: 'Tổng số',
  minAmount: 'Số tiền từ', maxAmount: 'Số tiền đến', email: 'Email', role: 'Vai trò', user: 'Người dùng',
  id: 'Mã', source: 'Nguồn', sourceId: 'Mã nguồn', userId: 'Mã người dùng', amount: 'Số tiền',
  balance: 'Số dư', balanceAfter: 'Số dư sau', held: 'Đang tạm giữ', available: 'Khả dụng',
  status: 'Trạng thái', type: 'Loại', entryType: 'Loại bút toán', requestType: 'Loại yêu cầu',
  referenceType: 'Loại tham chiếu', referenceId: 'Mã tham chiếu', description: 'Diễn giải',
  createdAt: 'Thời gian tạo', updatedAt: 'Thời gian cập nhật', occurredAt: 'Thời gian phát sinh',
  paidAt: 'Thời gian chi trả', completedAt: 'Thời gian hoàn tất', expiresAt: 'Hết hạn lúc',
  createdBy: 'Người tạo', actorId: 'Người thực hiện', adminId: 'Quản trị viên', adminNote: 'Ghi chú quản trị viên',
  provider: 'Nhà cung cấp', providerReference: 'Mã giao dịch nhà cung cấp', transferReference: 'Mã chuyển khoản',
  txnRef: 'Mã giao dịch', bookingId: 'Mã đặt sân', paymentId: 'Mã thanh toán', ownerId: 'Mã chủ sân',
  note: 'Ghi chú', reason: 'Lý do', format: 'Định dạng', rowCount: 'Số dòng', filters: 'Bộ lọc',
  from: 'Từ ngày', to: 'Đến ngày', range: 'Khoảng thời gian', startDate: 'Từ ngày', endDate: 'Đến ngày',
  groupBy: 'Nhóm theo', page: 'Trang', limit: 'Số dòng mỗi trang', metadata: 'Thông tin bổ sung',
  dryRun: 'Chạy thử', scanned: 'Đã kiểm tra', credited: 'Đã cộng ví', pending: 'Chờ xử lý',
  skipped: 'Đã bỏ qua', failed: 'Thất bại', key: 'Mã đối soát', action: 'Hành động',
  entityType: 'Loại đối tượng', entityId: 'Mã đối tượng', ledgerEntryId: 'Mã bút toán',
  before: 'Trước thay đổi', after: 'Sau thay đổi', reasonCode: 'Loại lý do',
};
const ENUM_FIELDS = new Set(['source', 'type', 'status', 'entryType', 'requestType', 'referenceType', 'provider', 'role', 'action', 'entityType', 'mode', 'groupBy', 'range']);
export function FinanceValue({ value, field = '', compact = false }: { value: unknown; field?: string; compact?: boolean }) {
  if (value === null || value === undefined) return <>—</>;
  if (typeof value === 'boolean') return <>{value ? 'Có' : 'Không'}</>;
  if (typeof value === 'number') return <>{/Id$/.test(field) || ['id', 'createdBy', 'decidedBy'].includes(field) ? String(value) : value.toLocaleString('vi-VN')}</>;
  if (typeof value === 'string') return renderFinanceString(value, field);
  if (Array.isArray(value)) return <div className="space-y-2">{value.map((item, index) => <FinanceValue key={index} value={item} field={field} compact={compact} />)}</div>;
  if (typeof value === 'object') return <dl className={compact ? 'grid grid-cols-2 gap-x-4 gap-y-2 text-xs' : 'space-y-2 text-sm'}>
    {Object.entries(value).map(([key, item]) => {
      const nested = item !== null && typeof item === 'object';
      return <div key={key} className={compact ? (nested ? 'col-span-2 min-w-0 space-y-2' : 'flex min-w-0 flex-wrap gap-x-1') : 'flex flex-wrap gap-x-2'}>
        <dt className="font-semibold text-muted-foreground" title={key}>{Object.hasOwn(FIELD_LABELS, key) ? FIELD_LABELS[key] : 'Thông tin bổ sung'}:</dt>
        <dd className="min-w-0 [overflow-wrap:anywhere]"><FinanceValue value={item} field={key} compact={compact} /></dd>
      </div>;
    })}
  </dl>;
  return <>—</>;
}

function renderFinanceString(value: string, field: string) {
  if (field.endsWith('At') && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))) return <>{new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</>;
  if (['from', 'to', 'startDate', 'endDate', 'bookingDate'].includes(field)) return <>{financeDate(value)}</>;
  return <>{ENUM_FIELDS.has(field) ? financeLabel(value) : value}</>;
}
