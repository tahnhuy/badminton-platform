import ExcelJS from 'exceljs';
import { AppError } from '../../errors/AppError';
import { FinanceAuditService, financeAuditService } from './FinanceAuditService';
import { FinanceQueryService, financeQueryService } from './FinanceQueryService';
import { ReconciliationService, reconciliationService } from './ReconciliationService';
import { resolveFinanceRange } from './finance-range';

export type FinanceExportType =
  | 'transactions'
  | 'top-ups'
  | 'payouts'
  | 'refunds'
  | 'revenue'
  | 'cash-flow'
  | 'reconciliation';

const MAX_ROWS = 20_000;

export interface FinanceExportQuery {
  range?: any;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'source' | 'owner';
  source?: any;
  status?: string;
  userId?: number;
  provider?: string;
  requestType?: string;
  from?: string;
  to?: string;
  referenceType?: string;
  referenceId?: number;
  minAmount?: string;
  maxAmount?: string;
}

function safeText(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`;
  return text;
}

function numberCell(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function applyHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.addRow(headers);
  row.font = { bold: true };
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF5EC' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBDCABA' } } };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

function setMoneyCell(row: ExcelJS.Row, column: number, value: unknown) {
  const cell = row.getCell(column);
  cell.value = numberCell(value);
  cell.numFmt = '#,##0';
}

function setDateCell(row: ExcelJS.Row, column: number, value: unknown) {
  const cell = row.getCell(column);
  cell.value = value ? new Date(String(value)) : '';
  if (value) cell.numFmt = 'dd/mm/yyyy hh:mm';
}

function addSummarySheet(sheet: ExcelJS.Worksheet, title: string, actorId: number, filters: Record<string, unknown>, rowCount: number, totals: Array<[string, string | number]>) {
  sheet.columns = [{ width: 30 }, { width: 60 }];
  sheet.addRow([title]).font = { bold: true, size: 14 };
  sheet.addRow(['Người xuất (Admin ID)', actorId]);
  sheet.addRow(['Thời điểm xuất', new Date().toISOString()]);
  sheet.addRow(['Múi giờ', 'Asia/Ho_Chi_Minh']);
  sheet.addRow(['Số dòng dữ liệu', rowCount]);
  sheet.addRow([]);
  sheet.addRow(['Bộ lọc']).font = { bold: true };
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') sheet.addRow([key, safeText(value)]);
  }
  sheet.addRow([]);
  sheet.addRow(['Tổng hợp']).font = { bold: true };
  for (const [label, value] of totals) {
    sheet.addRow([label, typeof value === 'number' ? value : safeText(value)]);
  }
}

export class FinanceExportService {
  constructor(
    private readonly queryService: FinanceQueryService = financeQueryService,
    private readonly auditService: FinanceAuditService = financeAuditService,
    private readonly reconciliation: ReconciliationService = reconciliationService,
  ) {}

  async build(type: FinanceExportType, query: FinanceExportQuery, actorId: number): Promise<{ buffer: Buffer; filename: string; rowCount: number }> {
    if (!['transactions', 'top-ups', 'payouts', 'refunds', 'revenue', 'cash-flow', 'reconciliation'].includes(type)) {
      throw new AppError('FINANCE_EXPORT_UNSUPPORTED_TYPE', 400, 'Unsupported finance export type');
    }

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Tổng hợp');
    workbook.creator = 'SmashPro Admin Finance';
    workbook.created = new Date();
    let rowCount = 0;
    let totals: Array<[string, string | number]> = [];
    const filters = this.filtersFor(type, query);

    if (type === 'transactions') {
      const data = await this.queryService.transactions({
        source: query.source,
        status: query.status,
        userId: query.userId,
        referenceType: query.referenceType,
        referenceId: query.referenceId,
        from: query.from,
        to: query.to,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
        page: 1,
        limit: MAX_ROWS,
      });
      if (data.meta.total > MAX_ROWS) throw new AppError('FINANCE_EXPORT_TOO_LARGE', 413, `Export exceeds ${MAX_ROWS} rows; narrow the filters`);
      const sheet = workbook.addWorksheet('Giao dịch');
      applyHeader(sheet, ['Nguồn', 'Mã', 'Thời gian', 'Loại', 'Trạng thái', 'User ID', 'Số tiền', 'Số dư sau', 'Tham chiếu', 'Diễn giải', 'Actor ID']);
      for (const row of data.data) {
        const r = sheet.addRow([
          row.source,
          row.sourceId,
          '',
          safeText(row.type),
          safeText(row.status),
          row.userId,
          '',
          '',
          row.referenceType ? `${row.referenceType}:${row.referenceId ?? ''}` : '',
          safeText(row.description),
          row.actorId ?? '',
        ]);
        setDateCell(r, 3, row.occurredAt);
        // Replace the placeholder amount/balance cells with numeric cells.
        r.getCell(7).value = numberCell(row.amount);
        r.getCell(7).numFmt = '#,##0';
        if (row.balanceAfter !== null) {
          r.getCell(8).value = numberCell(row.balanceAfter);
          r.getCell(8).numFmt = '#,##0';
        }
      }
      rowCount = data.data.length;
      const totalAmount = data.data.reduce((sum, row) => sum + numberCell(row.amount), 0);
      totals = [['Số dòng', rowCount], ['Tổng amount (có dấu)', totalAmount]];
    } else if (type === 'top-ups') {
      const data = await this.queryService.topUps({
        status: query.status, provider: query.provider, userId: query.userId, from: query.from, to: query.to, page: 1, limit: MAX_ROWS,
      });
      if (data.meta.total > MAX_ROWS) throw new AppError('FINANCE_EXPORT_TOO_LARGE', 413, `Export exceeds ${MAX_ROWS} rows; narrow the filters`);
      const sheet = workbook.addWorksheet('Nạp tiền');
      applyHeader(sheet, ['Mã', 'User ID', 'Số tiền', 'Trạng thái', 'Provider', 'Txn ref', 'Tạo lúc', 'Đã trả lúc']);
      for (const row of data.data) {
        const r = sheet.addRow([row.id, row.userId, '', safeText(row.status), safeText(row.provider), safeText(row.txnRef), '', '']);
        r.getCell(3).value = numberCell(row.amount);
        r.getCell(3).numFmt = '#,##0';
        setDateCell(r, 7, row.createdAt);
        setDateCell(r, 8, row.paidAt);
      }
      rowCount = data.data.length;
      totals = [['Số dòng', rowCount], ['Tổng tiền', data.data.reduce((sum, row) => sum + numberCell(row.amount), 0)]];
    } else if (type === 'payouts') {
      const data = await this.queryService.payouts({
        status: query.status, requestType: query.requestType, userId: query.userId, from: query.from, to: query.to, page: 1, limit: MAX_ROWS,
      });
      if (data.meta.total > MAX_ROWS) throw new AppError('FINANCE_EXPORT_TOO_LARGE', 413, `Export exceeds ${MAX_ROWS} rows; narrow the filters`);
      const sheet = workbook.addWorksheet('Payout');
      applyHeader(sheet, ['Mã', 'User ID', 'Loại', 'Số tiền', 'Trạng thái', 'Admin ID', 'Ghi chú', 'Mã chuyển khoản', 'Tạo lúc', 'Đã chi lúc']);
      for (const row of data.data) {
        const r = sheet.addRow([row.id, row.userId, safeText(row.requestType), '', safeText(row.status), row.adminId ?? '', safeText(row.adminNote), safeText(row.transferReference), '', '']);
        r.getCell(4).value = numberCell(row.amount);
        r.getCell(4).numFmt = '#,##0';
        setDateCell(r, 9, row.createdAt);
        setDateCell(r, 10, row.paidAt);
      }
      rowCount = data.data.length;
      totals = [['Số dòng', rowCount], ['Tổng tiền', data.data.reduce((sum, row) => sum + numberCell(row.amount), 0)]];
    } else if (type === 'refunds') {
      const data = await this.queryService.refunds({
        status: query.status, paymentId: query.referenceId, userId: query.userId, from: query.from, to: query.to, page: 1, limit: MAX_ROWS,
      });
      if (data.meta.total > MAX_ROWS) throw new AppError('FINANCE_EXPORT_TOO_LARGE', 413, `Export exceeds ${MAX_ROWS} rows; narrow the filters`);
      const sheet = workbook.addWorksheet('Hoàn tiền');
      applyHeader(sheet, ['Payment', 'Booking', 'User ID', 'Số tiền', 'Trạng thái', 'Provider', 'Lần thử', 'Lỗi gần nhất', 'Tạo lúc', 'Cập nhật']);
      for (const row of data.data as any[]) {
        const r = sheet.addRow([row.paymentId, row.bookingId ?? '', row.userId ?? '', '', safeText(row.status), safeText(row.provider), row.attempts, safeText(row.lastError), '', '']);
        r.getCell(4).value = numberCell(row.amount);
        r.getCell(4).numFmt = '#,##0';
        setDateCell(r, 9, row.createdAt);
        setDateCell(r, 10, row.updatedAt);
      }
      rowCount = data.data.length;
      totals = [['Số dòng', rowCount], ['Tổng tiền', (data.data as any[]).reduce((sum, row) => sum + numberCell(row.amount), 0)]];
    } else if (type === 'revenue') {
      const report = await this.queryService.revenue(query);
      const sheet = workbook.addWorksheet('Doanh thu');
      applyHeader(sheet, ['Nhóm', 'Nhãn', 'Gross', 'Refunds', 'Net ước tính', 'Owner earnings']);
      for (const row of report.rows) {
        const r = sheet.addRow([safeText(row.key), safeText(row.label), '', '', '', '']);
        r.getCell(3).value = numberCell(row.gross);
        r.getCell(4).value = numberCell(row.refunds);
        r.getCell(5).value = numberCell(row.net);
        r.getCell(6).value = numberCell(row.ownerEarnings);
        for (let i = 3; i <= 6; i += 1) r.getCell(i).numFmt = '#,##0';
      }
      rowCount = report.rows.length;
      totals = [
        ['Gross', numberCell(report.totals.grossRevenue)],
        ['Refunds', numberCell(report.totals.refunds)],
        ['Net ước tính', numberCell(report.totals.netEstimated)],
        ['Owner earnings', numberCell(report.totals.ownerEarnings)],
      ];
    } else if (type === 'cash-flow') {
      const report = await this.queryService.cashFlow(query);
      const sheet = workbook.addWorksheet('Dòng tiền');
      applyHeader(sheet, ['Ngày', 'Cash in', 'Cash out', 'Revenue gross']);
      const max = Math.max(report.series.cashIn.length, report.series.cashOut.length, report.series.revenue.length);
      for (let i = 0; i < max; i += 1) {
        const day = report.series.cashIn[i]?.day ?? report.series.cashOut[i]?.day ?? report.series.revenue[i]?.day;
        const r = sheet.addRow([day, '', '', '']);
        r.getCell(2).value = numberCell(report.series.cashIn[i]?.amount);
        r.getCell(3).value = numberCell(report.series.cashOut[i]?.amount);
        r.getCell(4).value = numberCell(report.series.revenue[i]?.amount);
        for (let c = 2; c <= 4; c += 1) r.getCell(c).numFmt = '#,##0';
      }
      rowCount = max;
      totals = [
        ['Cash in', numberCell(report.totals.cashIn)],
        ['Cash out', numberCell(report.totals.cashOut)],
        ['Gross revenue', numberCell(report.totals.grossRevenue)],
        ['Refunds', numberCell(report.totals.refunds)],
      ];
    } else {
      const report = await this.reconciliation.run(query);
      const sheet = workbook.addWorksheet('Đối soát');
      applyHeader(sheet, ['Key', 'Loại', 'Entity', 'Entity ID', 'Expected', 'Actual', 'Delta', 'Thông điệp']);
      for (const row of report.discrepancies) {
        sheet.addRow([safeText(row.key), safeText(row.type), safeText(row.entityType), safeText(row.entityId), safeText(row.expected), safeText(row.actual), safeText(row.delta), safeText(row.message)]);
      }
      rowCount = report.discrepancies.length;
      totals = [['Số lệch', report.discrepancies.length], ['Truncated', report.summary.truncated ? 'Có' : 'Không']];
    }

    for (const sheet of workbook.worksheets) {
      if (sheet.name === 'Tổng hợp') continue;
      sheet.columns.forEach((column, index) => {
        const header = sheet.getRow(1).getCell(index + 1).value;
        column.width = Math.max(14, Math.min(40, String(header ?? '').length + 6));
      });
    }

    addSummarySheet(summarySheet, `SmashPro Admin Finance — ${type}`, actorId, filters, rowCount, totals);

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `finance-${type}-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)}.xlsx`;
    await this.auditService.record({
      actorId,
      action: 'EXPORT',
      entityType: 'EXPORT',
      entityId: type,
      metadata: { filters, rowCount },
    });
    return { buffer: Buffer.from(buffer), filename, rowCount };
  }

  private filtersFor(type: FinanceExportType, query: FinanceExportQuery): Record<string, unknown> {
    if (type === 'revenue' || type === 'cash-flow' || type === 'reconciliation') {
      const bounds = resolveFinanceRange(query);
      return { range: bounds.range, startDate: bounds.startDate, endDate: bounds.endDate, groupBy: query.groupBy ?? null };
    }
    return {
      source: query.source ?? null,
      status: query.status ?? null,
      userId: query.userId ?? null,
      provider: query.provider ?? null,
      requestType: query.requestType ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
      referenceType: query.referenceType ?? null,
      referenceId: query.referenceId ?? null,
      minAmount: query.minAmount ?? null,
      maxAmount: query.maxAmount ?? null,
    };
  }
}

export const financeExportService = new FinanceExportService();
