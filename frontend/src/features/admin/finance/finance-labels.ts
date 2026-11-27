/** Presentation labels only; API codes and identifiers remain unchanged. */
const LABELS: Record<string, string> = {
  today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', this_month: 'Tháng này', custom: 'Khoảng ngày',
  day: 'Theo ngày', source: 'Theo nguồn', owner: 'Theo chủ sân', missing: 'Chưa có',
  'ledger TOP_UP entry': 'Bút toán nạp tiền', 'ledger WITHDRAWAL/PAYOUT entry': 'Bút toán rút tiền / chi trả',
  'ledger REFUND entry': 'Bút toán hoàn tiền', 'ledger PAYMENT entry': 'Bút toán thanh toán',
  'OWNER_EARNING ledger or settlement': 'Bút toán hoặc quyết toán thu nhập chủ sân',
  TOP_UP_TOTAL: 'Chênh lệch tổng nạp tiền', PAYMENT_TOTAL: 'Chênh lệch tổng thanh toán',
  REFUND_TOTAL: 'Chênh lệch tổng hoàn tiền', PAYOUT_TOTAL: 'Chênh lệch tổng chi trả',
  OWNER_EARNING_TOTAL: 'Chênh lệch tổng thu nhập chủ sân',
  TOURNAMENT_EARNING_TOTAL: 'Chênh lệch tổng tiền trả Organizer', TOURNAMENT_EARNING: 'Lệ phí giải (Organizer)',
  PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', SUCCESS: 'Thành công', FAILED: 'Thất bại',
  APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối', PAID: 'Đã chi trả', REFUNDED: 'Đã hoàn tiền',
  EXPIRED: 'Hết hạn', POSTED: 'Đã ghi sổ', CREDITED: 'Đã cộng ví',
  ledger: 'Sổ giao dịch ví', 'top-up': 'Nạp tiền', payout: 'Chi trả', refund: 'Hoàn tiền',
  CREDIT: 'Cộng tiền', DEBIT: 'Trừ tiền', TOP_UP: 'Nạp tiền', PAYMENT: 'Thanh toán', REFUND: 'Hoàn tiền',
  WITHDRAW: 'Rút tiền', WITHDRAWAL: 'Rút tiền', OWNER_PAYOUT: 'Chi trả chủ sân', PAYOUT: 'Chi trả',
  OWNER_EARNING_REVERSAL_PENDING: 'Chờ thu hồi thu nhập chủ sân', OWNER_EARNING: 'Thu nhập chủ sân', OWNER_EARNING_REVERSAL: 'Thu hồi thu nhập chủ sân',
  ADMIN_ADJUSTMENT: 'Điều chỉnh của quản trị viên', AUTO: 'Tự động', MANUAL: 'Thủ công',
  TOURNAMENT_REGISTRATION: 'Đăng ký giải đấu',
  BOOKING: 'Đặt sân', WALLET: 'Ví', FINANCE: 'Tài chính', finance: 'Tài chính', wallet: 'Ví',
  booking: 'Đặt sân', Booking: 'Đặt sân', registration: 'Đăng ký giải đấu', REGISTRATION: 'Đăng ký giải đấu',
  EXPORT: 'Xuất dữ liệu', WALLET_CREDIT: 'Cộng ví', WALLET_DEBIT: 'Trừ ví',
  PAYOUT_APPROVE: 'Duyệt chi trả', PAYOUT_REJECT: 'Từ chối chi trả', PAYOUT_MARK_PAID: 'Xác nhận đã chi',
  REFUND_RETRY: 'Thử lại hoàn tiền', REFUND_RESOLVE: 'Ghi nhận xử lý hoàn tiền',
  OWNER_EARNING_SWEEP: 'Rà soát thu nhập chủ sân', OWNER_EARNING_APPROVE: 'Duyệt thu nhập chủ sân',
  OWNER_EARNING_REJECT: 'Từ chối thu nhập chủ sân', OWNER_EARNING_REVERSE: 'Thu hồi thu nhập chủ sân',
  TOP_UP_MANUAL_MATCH: 'Ghép giao dịch nạp tiền', TOP_UP_MANUAL_MATCH_DUPLICATE: 'Ghép giao dịch đã ghi nhận',
  RECONCILIATION_RESOLVE: 'Xử lý chênh lệch', RECONCILIATION: 'Đối soát',
  BALANCE: 'Chênh lệch số dư', WALLET_BALANCE: 'Chênh lệch số dư ví',
  TOP_UP_MISSING_LEDGER: 'Nạp tiền chưa ghi sổ', PAYOUT_MISSING_LEDGER: 'Chi trả chưa ghi sổ',
  REFUND_MISSING_LEDGER: 'Hoàn tiền chưa ghi sổ', PAYMENT_MISSING_LEDGER: 'Thanh toán chưa ghi sổ',
  OWNER_EARNING_MISSING: 'Thiếu thu nhập chủ sân', OWNER_EARNING_SETTLEMENT: 'Quyết toán chủ sân',
  SEPAY: 'SePay', VNPAY: 'VNPay', MOCK: 'Mô phỏng', PLAYER: 'Người chơi', COURT_OWNER: 'Chủ sân', ADMIN: 'Quản trị viên',
};
export function financeLabel(value: string): string { return Object.hasOwn(LABELS, value) ? LABELS[value] : value; }
export function financeDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
}
export function financeText(value: string | null | undefined, translateCode = true): string {
  if (!value) return '—';
  return (translateCode ? financeLabel(value) : value)
    .replace(/^Mock wallet top-up$/g, 'Nạp tiền ví mô phỏng')
    .replace(/^Admin manual top-up/g, 'Quản trị viên ghép nạp tiền')
    .replace(/^SePay top-up/g, 'Nạp tiền qua SePay')
    .replace(/^SePay bank transfer/g, 'Chuyển khoản SePay')
    .replace(/^VNPAY top-up/g, 'Nạp tiền qua VNPay')
    .replace(/^Owner earning$/g, 'Thu nhập chủ sân')
    .replace(/^(Doanh thu|Thanh toán|Hoàn ví|Hoàn tiền) booking /, '$1 đặt sân ');
}
export function discrepancyMessage(row: { type: string; entityId: string | null; message: string }): string {
  const messages: Record<string, string> = {
    OWNER_EARNING_REVERSAL_PENDING: 'Đặt sân đã hoàn tiền nhưng chưa thu hồi được thu nhập chủ sân. Có thể thử lại khi ví chủ sân đủ số dư.',
    TOP_UP_TOTAL: 'Tổng nạp tiền thành công không khớp tổng bút toán nạp tiền.',
    PAYMENT_TOTAL: 'Tổng thanh toán thành công không khớp tổng bút toán thanh toán.',
    REFUND_TOTAL: 'Tổng tiền đã hoàn không khớp tổng bút toán hoàn tiền.',
    PAYOUT_TOTAL: 'Tổng tiền đã chi không khớp tổng bút toán rút tiền / chi trả.',
    OWNER_EARNING_TOTAL: 'Tổng đặt sân đã hoàn tất và thanh toán không khớp tổng bút toán thu nhập chủ sân.',
    TOURNAMENT_EARNING_TOTAL: 'Lệ phí của các giải đã kết thúc không khớp tổng bút toán trả Organizer.',
    WALLET_BALANCE: 'Số dư ví không khớp tổng bút toán.',
    TOP_UP_MISSING_LEDGER: 'Nạp tiền thành công nhưng chưa có bút toán tương ứng.',
    PAYOUT_MISSING_LEDGER: 'Đã chi trả nhưng chưa có bút toán tương ứng.',
    REFUND_MISSING_LEDGER: 'Tiền hoàn không khớp bút toán tổng hoặc phần của thành viên.',
    PAYMENT_MISSING_LEDGER: 'Thanh toán không khớp bút toán tổng hoặc phần của thành viên.',
    OWNER_EARNING_MISSING: 'Đặt sân đã hoàn tất và thanh toán nhưng chưa có quyết toán cho chủ sân.',
  };
  return Object.hasOwn(messages, row.type) ? messages[row.type] : financeText(row.message);
}
