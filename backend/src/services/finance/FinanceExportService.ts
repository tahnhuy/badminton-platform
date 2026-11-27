import { financeIdentities } from '../../repositories/finance/FinanceIdentityRepository';
import { FINANCE_EXPORT_CONFIG, financeExportDate, formatFinanceDataSheet, formatFinanceSummary } from './finance-export-template';
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
  sheet.addRow(headers);
}

function setDateCell(row: ExcelJS.Row, column: number, value: unknown) {
  const cell = row.getCell(column);
  cell.value = value ? financeExportDate(new Date(String(value))) : '';
  if (value) cell.numFmt = 'dd/mm/yyyy hh:mm';
}

export class FinanceExportService {
  constructor(
    private readonly queryService: FinanceQueryService = financeQueryService,
    private readonly auditService: FinanceAuditService = financeAuditService,
    private readonly reconciliation: ReconciliationService = reconciliationService,
    private readonly identityLookup: typeof financeIdentities = financeIdentities,
  ) {}

  async build(type: FinanceExportType, query: FinanceExportQuery, actorId: number): Promise<{ buffer: Buffer; filename: string; rowCount: number }> {
    if (!['transactions', 'top-ups', 'payouts', 'refunds', 'revenue', 'cash-flow', 'reconciliation'].includes(type)) {
      throw new AppError('FINANCE_EXPORT_UNSUPPORTED_TYPE', 400, 'Unsupported finance export type');
    }

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Tổng hợp');
    workbook.creator = 'SmashPro Admin Finance';
    workbook.created = new Date();
    workbook.views = [{ x: 0, y: 0, width: 1440, height: 900, visibility: 'visible', firstSheet: 0, activeTab: 1 }];
    let rowCount = 0;
    let totals: Array<[string, string | number]> = [];
    const filters = this.filtersFor(type, query);

    if (type === 'transactions') {
      ({ rowCount, totals } = await this.exportTransactions(query, workbook, rowCount, totals));
    } else if (type === 'top-ups') {
      ({ rowCount, totals } = await this.exportTopUps(query, workbook, rowCount, totals));
    } else if (type === 'payouts') {
      ({ rowCount, totals } = await this.exportPayouts(query, workbook, rowCount, totals));
    } else if (type === 'refunds') {
      ({ rowCount, totals } = await this.exportRefunds(query, workbook, rowCount, totals));
    } else if (type === 'revenue') {
      ({ rowCount, totals } = await this.exportRevenue(query, workbook, rowCount, totals));
    } else if (type === 'cash-flow') {
      ({ rowCount, totals } = await this.exportCashFlow(query, workbook, rowCount, totals));
    } else {
      const report = await this.reconciliation.run(query);
      const sheet = workbook.addWorksheet('Đối soát');
      applyHeader(sheet, ['Mã đối soát', 'Loại kiểm tra', 'Đối tượng', 'Mã đối tượng', 'Dự kiến', 'Thực tế', 'Chênh lệch (VND)', 'Thông điệp']);
      for (const row of report.discrepancies) {
        sheet.addRow([safeText(row.key), safeText(row.type), safeText(row.entityType), safeText(row.entityId), safeText(row.expected), safeText(row.actual), safeText(row.delta), safeText(row.message)]);
      }
      rowCount = report.discrepancies.length;
      totals = [['Số lệch', report.discrepancies.length], ['Đã giới hạn kết quả', report.summary.truncated ? 'Có' : 'Không']];
    }

    const dataSheet = workbook.worksheets[1];
    const identityColumns = FINANCE_EXPORT_CONFIG[type].identities;
    const ids = new Set<number>([actorId]);
    dataSheet.eachRow((row, index) => {
      if (index === 1) return;
      for (const column of identityColumns) {
        const id = Number(row.getCell(column).value);
        if (id > 0) ids.add(id);
      }
      if (type === 'revenue' && query.groupBy === 'owner') ids.add(Number(row.getCell(1).value));
      if (type === 'reconciliation' && row.getCell(3).value === 'WALLET') ids.add(Number(row.getCell(4).value));
    });
    const identities = new Map((await this.identityLookup([...ids])).map(user => [user.id, user]));
    const context = { type, actorId, identities, filters, generatedAt: workbook.created, rowCount, totals };
    formatFinanceDataSheet(dataSheet, context);
    formatFinanceSummary(summarySheet, context);

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

  private async exportTransactions(
    query: FinanceExportQuery,
    workbook: ExcelJS.Workbook,
    rowCount: number,
    totals: [string, string | number][],
  ) {
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
    applyHeader(sheet, ['Nguồn', 'Mã giao dịch', 'Thời gian', 'Loại giao dịch', 'Trạng thái', 'Người dùng', 'Số tiền (VND)', 'Số dư sau (VND)', 'Tham chiếu', 'Diễn giải', 'Người thực hiện']);
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
    totals = [['Số dòng', rowCount], ['Tổng tiền có dấu', totalAmount]];
    return { rowCount, totals };
  }

  private async exportTopUps(
    query: FinanceExportQuery,
    workbook: ExcelJS.Workbook,
    rowCount: number,
    totals: [string, string | number][],
  ) {
    const data = await this.queryService.topUps({
      status: query.status, provider: query.provider, userId: query.userId, from: query.from, to: query.to, page: 1, limit: MAX_ROWS,
    });
    if (data.meta.total > MAX_ROWS) throw new AppError('FINANCE_EXPORT_TOO_LARGE', 413, `Export exceeds ${MAX_ROWS} rows; narrow the filters`);
    const sheet = workbook.addWorksheet('Nạp tiền');
    applyHeader(sheet, ['Mã lệnh', 'Người dùng', 'Số tiền (VND)', 'Trạng thái', 'Nhà cung cấp', 'Mã giao dịch', 'Thời gian tạo', 'Thanh toán lúc']);
    for (const row of data.data) {
      const r = sheet.addRow([row.id, row.userId, '', safeText(row.status), safeText(row.provider), safeText(row.txnRef), '', '']);
      r.getCell(3).value = numberCell(row.amount);
      r.getCell(3).numFmt = '#,##0';
      setDateCell(r, 7, row.createdAt);
      setDateCell(r, 8, row.paidAt);
    }
    rowCount = data.data.length;
    totals = [['Số dòng', rowCount], ['Tổng tiền', data.data.reduce((sum, row) => sum + numberCell(row.amount), 0)]];
    return { rowCount, totals };
  }

  private async exportPayouts(
    query: FinanceExportQuery,
    workbook: ExcelJS.Workbook,
    rowCount: number,
    totals: [string, string | number][],
  ) {
    const data = await this.queryService.payouts({
      status: query.status, requestType: query.requestType, userId: query.userId, from: query.from, to: query.to, page: 1, limit: MAX_ROWS,
    });
    if (data.meta.total > MAX_ROWS) throw new AppError('FINANCE_EXPORT_TOO_LARGE', 413, `Export exceeds ${MAX_ROWS} rows; narrow the filters`);
    const sheet = workbook.addWorksheet('Chi trả');
    applyHeader(sheet, ['Mã yêu cầu', 'Người nhận', 'Loại yêu cầu', 'Số tiền (VND)', 'Trạng thái', 'Người xử lý', 'Ghi chú', 'Mã chuyển khoản', 'Thời gian tạo', 'Đã chi lúc']);
    for (const row of data.data) {
      const r = sheet.addRow([row.id, row.userId, safeText(row.requestType), '', safeText(row.status), row.adminId ?? '', safeText(row.adminNote), safeText(row.transferReference), '', '']);
      r.getCell(4).value = numberCell(row.amount);
      r.getCell(4).numFmt = '#,##0';
      setDateCell(r, 9, row.createdAt);
      setDateCell(r, 10, row.paidAt);
    }
    rowCount = data.data.length;
    totals = [['Số dòng', rowCount], ['Tổng tiền', data.data.reduce((sum, row) => sum + numberCell(row.amount), 0)]];
    return { rowCount, totals };
  }

  private async exportRefunds(
    query: FinanceExportQuery,
    workbook: ExcelJS.Workbook,
    rowCount: number,
    totals: [string, string | number][],
  ) {
    const data = await this.queryService.refunds({
      status: query.status, paymentId: query.referenceId, userId: query.userId, from: query.from, to: query.to, page: 1, limit: MAX_ROWS,
    });
    if (data.meta.total > MAX_ROWS) throw new AppError('FINANCE_EXPORT_TOO_LARGE', 413, `Export exceeds ${MAX_ROWS} rows; narrow the filters`);
    const sheet = workbook.addWorksheet('Hoàn tiền');
    applyHeader(sheet, ['Mã thanh toán', 'Mã đặt sân', 'Người dùng', 'Số tiền (VND)', 'Trạng thái', 'Nhà cung cấp', 'Số lần thử', 'Lỗi gần nhất', 'Thời gian tạo', 'Cập nhật lúc']);
    for (const row of data.data as any[]) {
      const r = sheet.addRow([row.paymentId, row.bookingId ?? '', row.userId ?? '', '', safeText(row.status), safeText(row.provider), row.attempts, safeText(row.lastError), '', '']);
      r.getCell(4).value = numberCell(row.amount);
      r.getCell(4).numFmt = '#,##0';
      setDateCell(r, 9, row.createdAt);
      setDateCell(r, 10, row.updatedAt);
    }
    rowCount = data.data.length;
    totals = [['Số dòng', rowCount], ['Tổng tiền', (data.data as any[]).reduce((sum, row) => sum + numberCell(row.amount), 0)]];
    return { rowCount, totals };
  }

  private async exportRevenue(
    query: FinanceExportQuery,
    workbook: ExcelJS.Workbook,
    rowCount: number,
    totals: [string, string | number][],
  ) {
    const report = await this.queryService.revenue(query);
    const sheet = workbook.addWorksheet('Doanh thu');
    applyHeader(sheet, ['Nhóm', 'Nhãn', 'Doanh thu gộp (VND)', 'Hoàn tiền (VND)', 'Doanh thu ròng ước tính (VND)', 'Thu nhập chủ sân (VND)']);
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
      ['Doanh thu gộp', numberCell(report.totals.grossRevenue)],
      ['Hoàn tiền', numberCell(report.totals.refunds)],
      ['Doanh thu ròng ước tính', numberCell(report.totals.netEstimated)],
      ['Thu nhập chủ sân', numberCell(report.totals.ownerEarnings)],
    ];
    return { rowCount, totals };
  }

  private async exportCashFlow(
    query: FinanceExportQuery,
    workbook: ExcelJS.Workbook,
    rowCount: number,
    totals: [string, string | number][],
  ) {
    const report = await this.queryService.cashFlow(query);
    const sheet = workbook.addWorksheet('Dòng tiền');
    applyHeader(sheet, ['Ngày', 'Tiền vào (VND)', 'Tiền ra (VND)', 'Doanh thu gộp (VND)']);
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
      ['Tiền vào', numberCell(report.totals.cashIn)],
      ['Tiền ra', numberCell(report.totals.cashOut)],
      ['Doanh thu gộp', numberCell(report.totals.grossRevenue)],
      ['Hoàn tiền', numberCell(report.totals.refunds)],
    ];
    return { rowCount, totals };
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
