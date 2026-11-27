import ExcelJS from 'exceljs';
import type { FinanceExportType } from './FinanceExportService';

const COLOR = { dark: '143D2A', green: '006B2C', lime: 'D8EF9A', ink: '203B30', muted: '697C70', line: 'DBE5DD', paper: 'F3F6F1', white: 'FFFFFF', pale: 'EAF4EC', amber: 'FFF0CC', amberInk: '916215', red: 'FBE9E7', redInk: 'A63D32' };
export const FINANCE_MONEY_FORMAT = '#,##0" ₫";[Red](#,##0)" ₫";"—"';
export const FINANCE_TABLE_HEADER_ROW = 1;
const LABELS: Record<string, string> = {
  ledger: 'Sổ ví', 'top-up': 'Nạp tiền', payout: 'Chi trả', refund: 'Hoàn tiền', booking: 'Đặt sân', registration: 'Đăng ký giải đấu',
  TOP_UP: 'Nạp tiền', PAYMENT: 'Thanh toán', REFUND: 'Hoàn tiền', WITHDRAWAL: 'Rút tiền', OWNER_PAYOUT: 'Chi trả chủ sân', PAYOUT: 'Chi trả',
  OWNER_EARNING: 'Thu nhập chủ sân', OWNER_EARNING_REVERSAL: 'Thu hồi thu nhập chủ sân', TOURNAMENT_EARNING: 'Thu nhập giải đấu',
  ADMIN_ADJUSTMENT: 'Điều chỉnh ví', CREDIT: 'Cộng tiền', DEBIT: 'Trừ tiền', BOOKING: 'Đặt sân', TOURNAMENT_REGISTRATION: 'Đăng ký giải đấu',
  WALLET: 'Ví', TOURNAMENT: 'Giải đấu', SUCCESS: 'Thành công', POSTED: 'Đã ghi sổ', PAID: 'Đã chi', PENDING: 'Chờ xử lý',
  PROCESSING: 'Đang xử lý', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', FAILED: 'Thất bại', EXPIRED: 'Hết hạn', REFUNDED: 'Đã hoàn tiền',
  REFUND_PENDING: 'Chờ hoàn tiền', REFUND_FAILED: 'Hoàn tiền thất bại', SEPAY: 'SePay', MOCK: 'Mô phỏng',
  day: 'Theo ngày', source: 'Theo nguồn', owner: 'Theo chủ sân', today: 'Hôm nay', '7d': '7 ngày', '30d': '30 ngày', this_month: 'Tháng này', custom: 'Tùy chọn',
  TOP_UP_TOTAL: 'Tổng nạp tiền', PAYMENT_TOTAL: 'Tổng thanh toán', REFUND_TOTAL: 'Tổng hoàn tiền', PAYOUT_TOTAL: 'Tổng chi trả',
  OWNER_EARNING_TOTAL: 'Tổng thu nhập chủ sân', TOURNAMENT_EARNING_TOTAL: 'Tổng thu nhập giải đấu', WALLET_BALANCE: 'Số dư ví',
  TOP_UP_MISSING_LEDGER: 'Nạp tiền thiếu bút toán', PAYMENT_MISSING_LEDGER: 'Thanh toán thiếu bút toán', REFUND_MISSING_LEDGER: 'Hoàn tiền thiếu bút toán',
  PAYOUT_MISSING_LEDGER: 'Chi trả thiếu bút toán', OWNER_EARNING_MISSING: 'Thiếu thu nhập chủ sân', OWNER_EARNING_REVERSAL_PENDING: 'Chờ thu hồi thu nhập chủ sân',
  missing: 'Chưa có', 'ledger TOP_UP entry': 'Bút toán nạp tiền', 'ledger PAYMENT entry': 'Bút toán thanh toán',
  'ledger REFUND entry': 'Bút toán hoàn tiền', 'ledger WITHDRAWAL/PAYOUT entry': 'Bút toán chi trả', 'OWNER_EARNING ledger or settlement': 'Bút toán hoặc quyết toán thu nhập chủ sân',
};
const RECONCILIATION_MESSAGES: Record<string, string> = {
  WALLET_BALANCE: 'Số dư ví không khớp tổng các bút toán trong lịch sử ví.',
  TOP_UP_TOTAL: 'Tổng nạp tiền thành công không khớp tổng bút toán nạp ví.',
  PAYMENT_TOTAL: 'Tổng thanh toán không khớp tổng bút toán trừ ví.',
  REFUND_TOTAL: 'Tổng tiền đã hoàn không khớp tổng bút toán hoàn ví.',
  PAYOUT_TOTAL: 'Tổng chi trả đã thanh toán không khớp tổng bút toán chi trả.',
  OWNER_EARNING_TOTAL: 'Thu nhập dự kiến từ đặt sân không khớp bút toán thu nhập chủ sân.',
  TOURNAMENT_EARNING_TOTAL: 'Thu nhập dự kiến từ giải đấu không khớp bút toán thu nhập giải đấu.',
  TOP_UP_MISSING_LEDGER: 'Lệnh nạp thành công nhưng thiếu bút toán cộng ví tương ứng.',
  PAYMENT_MISSING_LEDGER: 'Thanh toán thành công nhưng thiếu bút toán trừ ví tương ứng.',
  REFUND_MISSING_LEDGER: 'Khoản hoàn thành công nhưng thiếu bút toán hoàn ví tương ứng.',
  PAYOUT_MISSING_LEDGER: 'Yêu cầu đã chi nhưng thiếu bút toán chi trả tương ứng.',
  OWNER_EARNING_MISSING: 'Đặt sân đã hoàn tất và thanh toán nhưng thiếu bút toán hoặc quyết toán thu nhập chủ sân.',
  OWNER_EARNING_REVERSAL_PENDING: 'Đặt sân đã hoàn tiền nhưng vẫn cần thu hồi thu nhập đã cộng cho chủ sân.',
};
const FILTER_LABELS: Record<string, string> = { range: 'Khoảng thời gian', startDate: 'Từ ngày', endDate: 'Đến ngày', from: 'Từ ngày', to: 'Đến ngày', groupBy: 'Nhóm theo', source: 'Nguồn', status: 'Trạng thái', userId: 'Mã người dùng', provider: 'Nhà cung cấp', requestType: 'Loại yêu cầu', referenceType: 'Loại tham chiếu', referenceId: 'Mã tham chiếu', minAmount: 'Số tiền từ', maxAmount: 'Số tiền đến' };
export function exportLabel(value: unknown): string { const text = String(value ?? ''); return LABELS[text] ?? text; }
export function exportSafeText(value: unknown): string {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
export function financeExportDate(value: Date): Date {
  // Excel dates have no timezone: store Vietnam wall-clock time as a date serial.
  return new Date(value.getTime() + 7 * 60 * 60 * 1000);
}
function displayDate(value: unknown): string {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.split('-').reverse().join('/') : exportLabel(value);
}
type Identity = { id: number; name: string | null; email: string };
export function exportIdentity(id: unknown, identities: Map<number, Identity>): string {
  if (!id) return 'Hệ thống';
  const user = identities.get(Number(id));
  return exportSafeText([user?.name, user?.email, `#${id}`].filter(Boolean).join('\n'));
}
interface TemplateConfig { title: string; widths: number[]; money: number[]; enums: number[]; identities: number[]; status?: number; note: string }
export const FINANCE_EXPORT_CONFIG: Record<FinanceExportType, TemplateConfig> = {
  transactions: { title: 'Báo cáo giao dịch', widths: [16,14,23,23,20,30,23,23,28,42,30], money: [7,8], enums: [1,4,5], identities: [6,11], status: 5, note: 'Tổng tiền có dấu là biến động ròng của các dòng được xuất; không cộng cột số dư sau.' },
  'top-ups': { title: 'Báo cáo nạp tiền', widths: [16,30,23,20,20,30,23,23], money: [3], enums: [4,5], identities: [2], status: 4, note: 'Tổng bảng gồm tất cả lệnh theo bộ lọc, kể cả chờ hoặc thất bại; không đồng nghĩa tiền nạp thành công.' },
  payouts: { title: 'Báo cáo chi trả', widths: [16,30,23,23,20,30,36,28,23,23], money: [4], enums: [3,5], identities: [2,6], status: 5, note: 'Tổng yêu cầu không đồng nghĩa tiền đã chi. Tiền ra chỉ ghi nhận yêu cầu đã chi trả thành công.' },
  refunds: { title: 'Báo cáo hoàn tiền', widths: [19,18,30,23,20,20,15,42,23,23], money: [4], enums: [5,6], identities: [3], status: 5, note: 'Tổng bảng bao gồm mọi trạng thái đang hiển thị; tiền hoàn vào ví khác với khoản chuyển tiền ra ngân hàng.' },
  revenue: { title: 'Báo cáo doanh thu', widths: [23,34,28,25,32,30], money: [3,4,5,6], enums: [], identities: [], note: 'Doanh thu ròng ước tính = doanh thu gộp − hoàn tiền; không phải lợi nhuận hay báo cáo kế toán/quyết toán.' },
  'cash-flow': { title: 'Báo cáo dòng tiền', widths: [28,36,36,38], money: [2,3,4], enums: [], identities: [], note: 'Tiền vào = nạp ví thành công; tiền ra = chi trả đã thanh toán. Doanh thu gộp được trình bày riêng, không cộng lần nữa vào tiền vào.' },
  reconciliation: { title: 'Báo cáo đối soát', widths: [36,32,24,18,32,32,25,58], money: [], enums: [2,3,5,6], identities: [], note: 'Đối soát dữ liệu nội bộ, không tự sửa số dư. Không cộng các chênh lệch khác loại vì có thể trùng nguyên nhân; xem Tổng hợp để biết có giới hạn kết quả hay không.' },
};
const fill = (color: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } });
const font = (size = 10, bold = false, color = COLOR.ink): Partial<ExcelJS.Font> => ({ name: 'Aptos', size, bold, color: { argb: 'FF' + color } });
function band(sheet: ExcelJS.Worksheet, row: number, start: number, end: number, value: ExcelJS.CellValue, bg = COLOR.white, size = 10, color = COLOR.ink, bold = false) {
  if (end > start) sheet.mergeCells(row, start, row, end);
  const cell = sheet.getCell(row, start); cell.value = value; cell.fill = fill(bg); cell.font = font(size, bold, color); cell.alignment = { vertical: 'middle', wrapText: true };
}
export interface FinanceTemplateContext {
  type: FinanceExportType; actorId: number; identities: Map<number, Identity>; filters: Record<string, unknown>;
  generatedAt: Date; rowCount: number; totals: Array<[string, string | number]>;
}
function filteredEntries(filters: Record<string, unknown>) { return Object.entries(filters).filter(([, v]) => v !== null && v !== undefined && v !== ''); }
function setup(sheet: ExcelJS.Worksheet) {
  sheet.properties.defaultRowHeight = 20;
  sheet.properties.tabColor = { argb: 'FF' + COLOR.green };
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .25, right: .25, top: .4, bottom: .4, header: .15, footer: .15 } };
  sheet.headerFooter.oddFooter = '&LSmashPro | Quản lý tài chính&CĐơn vị: VND · Giờ Việt Nam&RTrang &P / &N';
}
function header(sheet: ExcelJS.Worksheet, n: number, title: string, ctx: FinanceTemplateContext) {
  setup(sheet);
  band(sheet, 1, 1, n, 'SMASHPRO  /  QUẢN LÝ TÀI CHÍNH', COLOR.dark, 10, COLOR.lime, true);
  band(sheet, 2, 1, n, title.toUpperCase(), COLOR.white, 18, COLOR.dark, true);
  band(sheet, 3, 1, n, 'BÁO CÁO VẬN HÀNH  ·  ĐƠN VỊ: VND  ·  MÚI GIỜ: VIỆT NAM (UTC+7)', COLOR.lime, 9, COLOR.dark);
  const countAndTotals: Array<[string, string | number]> = [['Số dòng', ctx.rowCount], ...ctx.totals.filter(([key]) => key !== 'Số dòng')];
  const metrics = ctx.totals.length > 2 ? ctx.totals.slice(0,3) : countAndTotals.slice(0,3);
  while(metrics.length < 3) metrics.push(['Đơn vị tiền', 'VND']);
  const parts = [1, Math.floor(n/3)+1, Math.floor(2*n/3)+1, n+1];
  metrics.forEach(([label,value], i) => {
    band(sheet, 4, parts[i], parts[i+1]-1, label.toUpperCase(), COLOR.pale, 9, COLOR.muted, true);
    band(sheet, 5, parts[i], parts[i+1]-1, typeof value === 'string' ? exportSafeText(value) : value, COLOR.pale, 14, COLOR.green, true);
    sheet.getCell(5, parts[i]).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    if(typeof value === 'number' && !/Số dòng|Số lệch/.test(label)) sheet.getCell(5, parts[i]).numFmt = FINANCE_MONEY_FORMAT;
  });
  const filters = filteredEntries(ctx.filters).map(([k,v]) => `${FILTER_LABELS[k] ?? k}: ${displayDate(v)}`).join('  |  ') || 'Tất cả dữ liệu theo bộ lọc hiện tại';
  band(sheet, 6, 1, n, exportSafeText(filters), COLOR.paper, 9);
  const operator = ctx.identities.get(ctx.actorId);
  band(sheet, 7, 1, n, exportSafeText(`Người xuất: ${operator?.name ? operator.name + ' · ' : ''}${operator?.email ?? '#' + ctx.actorId}  |  ${ctx.generatedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`), COLOR.white, 9, COLOR.muted);
  [20,28,20,17,23,20,20].forEach((height,i) => { sheet.getRow(i+1).height = height; });
  sheet.getRow(6).height = Math.max(20, Math.ceil(filters.length / Math.max(70, n * 18)) * 14);
}
/** Applies the approved compact layout without changing which data rows were exported. */
export function formatFinanceDataSheet(sheet: ExcelJS.Worksheet, ctx: FinanceTemplateContext) {
  const config = FINANCE_EXPORT_CONFIG[ctx.type];
  const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
  const n = config.widths.length;
  const data = Array.from({ length: ctx.rowCount }, (_,i) => Array.from({ length: n }, (_,j) => sheet.getCell(i+2,j+1).value));
  if(ctx.type==='cash-flow' || (ctx.type==='revenue' && (ctx.filters.groupBy ?? 'day')==='day')) {
    data.sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
  }
  sheet.spliceRows(1, sheet.rowCount);
  sheet.columns = config.widths.map(width => ({ width }));
  setup(sheet);
  sheet.getRow(1).values = headers;
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell(cell => { cell.fill=fill(COLOR.green);cell.font=font(10,true,COLOR.white);cell.alignment={vertical:'middle',wrapText:true};cell.border={bottom:{style:'medium',color:{argb:'FF'+COLOR.lime}}}; });
  data.forEach((values,index) => {
    const row = sheet.getRow(index+2);row.height=44;
    values.forEach((raw,j) => {
      const col=j+1, cell=row.getCell(col);
      let value=raw;
      if(config.identities.includes(col)) value = raw ? exportIdentity(raw,ctx.identities) : (ctx.type==='refunds' && col===3 ? '—' : 'Hệ thống');
      else if(config.enums.includes(col) && typeof raw==='string') value=exportLabel(raw);
      if(ctx.type==='transactions' && col===9 && typeof raw==='string') { const [code,...id]=raw.split(':');value=exportLabel(code)+(id.length?' #'+id.join(':'):''); }
      if(ctx.type==='revenue' && ctx.filters.groupBy==='source' && (col===1||col===2)) value=exportLabel(raw);
      if(ctx.type==='revenue' && ctx.filters.groupBy==='owner' && col===2) value=exportIdentity(values[0],ctx.identities);
      if((ctx.type==='cash-flow' && col===1)||(ctx.type==='revenue' && (ctx.filters.groupBy ?? 'day')==='day' && col<=2)) value=displayDate(raw);
      if(ctx.type==='reconciliation' && col>=5 && col<=7 && typeof raw==='string') {
        const numeric = raw.replace(/^'(?=-?\d)/, '');
        if (/^-?\d+(\.\d+)?$/.test(numeric)) value = Number(numeric);
      }
      if(ctx.type==='reconciliation' && col===8) value=RECONCILIATION_MESSAGES[String(values[1])] ?? raw;
      if(ctx.type==='reconciliation' && col===3 && String(values[2]).toUpperCase()==='WALLET') value=exportIdentity(values[3],ctx.identities);
      cell.value=typeof value==='string' ? exportSafeText(value) : value;
      cell.font=font();cell.fill=fill(index%2?COLOR.white:COLOR.paper);cell.alignment={vertical:'middle',wrapText:true,indent:1};
      cell.border={bottom:{style:'hair',color:{argb:'FF'+COLOR.line}}};
      if(config.money.includes(col) || (ctx.type==='reconciliation' && col>=5&&col<=7&&typeof value==='number')) {cell.numFmt=FINANCE_MONEY_FORMAT;cell.font=font(10,true);cell.alignment.horizontal='right';}
      if(value instanceof Date) {cell.numFmt='dd/mm/yyyy hh:mm';cell.font=font(9);cell.alignment={vertical:'middle',horizontal:'left',shrinkToFit:true};}
      if(col===config.status) {const code=String(raw);const bad=['FAILED','REJECTED','REFUND_FAILED'].includes(code);const wait=['PENDING','PROCESSING','APPROVED','REFUND_PENDING'].includes(code);cell.fill=fill(bad?COLOR.red:wait?COLOR.amber:COLOR.pale);cell.font=font(10,true,bad?COLOR.redInk:wait?COLOR.amberInk:COLOR.green);cell.alignment.horizontal='center';}
    });
    row.height = Math.min(150, Math.max(44, ...values.map((value, index) => {
      const text = String(row.getCell(index+1).text);
      const lines = text.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / Math.max(8, config.widths[index]-4))), 0);
      return lines * 13 + 12;
    })));
  });
  if(!data.length) {band(sheet,2,1,n,'Không có dữ liệu phù hợp với bộ lọc.',COLOR.paper,10,COLOR.muted);sheet.getRow(2).height=30;}
  sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,1+data.length),column:n}};
  sheet.views=[{state:'frozen',xSplit:1,ySplit:1,topLeftCell:'B2',showGridLines:false,zoomScale:90}];
  sheet.pageSetup.printTitlesRow='1:1';sheet.pageSetup.printArea=`A1:${sheet.getColumn(n).letter}${Math.max(2,1+data.length)}`;
}
export function formatFinanceSummary(sheet: ExcelJS.Worksheet, ctx: FinanceTemplateContext) {
  sheet.columns=Array.from({length:6},()=>({width:23}));
  header(sheet,6,'Tổng hợp · '+FINANCE_EXPORT_CONFIG[ctx.type].title,ctx);
  band(sheet,8,1,2,'NỘI DUNG',COLOR.green,10,COLOR.white,true);band(sheet,8,3,6,'GIÁ TRỊ',COLOR.green,10,COLOR.white,true);sheet.getRow(8).height=28;
  const rows: Array<[string,string|number]> = [['Loại báo cáo',FINANCE_EXPORT_CONFIG[ctx.type].title],['Người xuất',exportIdentity(ctx.actorId,ctx.identities)],['Thời điểm xuất',ctx.generatedAt.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})],['Múi giờ','Asia/Ho_Chi_Minh (UTC+7)'],['Số dòng dữ liệu',ctx.rowCount],...filteredEntries(ctx.filters).map(([k,v]):[string,string]=>[FILTER_LABELS[k]??k,displayDate(v)]),...ctx.totals, ['Ghi chú', FINANCE_EXPORT_CONFIG[ctx.type].note]];
  rows.forEach(([label,value],i)=>{const row=i+9,bg=i%2?COLOR.white:COLOR.paper;band(sheet,row,1,2,exportSafeText(label),bg,10,COLOR.muted,true);band(sheet,row,3,6,typeof value==='string'?exportSafeText(value):value,bg);sheet.getRow(row).height=label==='Ghi chú'?56:typeof value==='string'&&value.includes('\n')?48:26;if(typeof value==='number'&&!/Số dòng|Số lệch/.test(label))sheet.getCell(row,3).numFmt=FINANCE_MONEY_FORMAT;});
  sheet.views=[{state:'frozen',ySplit:8,showGridLines:false,zoomScale:90}];sheet.pageSetup.printTitlesRow='8:8';sheet.pageSetup.printArea=`A1:F${8+rows.length}`;
}
