import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { FinanceExportService, type FinanceExportType } from '../services/finance/FinanceExportService';
import { FINANCE_EXPORT_CONFIG } from '../services/finance/finance-export-template';
import type { FinanceQueryService } from '../services/finance/FinanceQueryService';
import type { FinanceAuditService } from '../services/finance/FinanceAuditService';
import type { ReconciliationService } from '../services/finance/ReconciliationService';

const instant = new Date('2026-11-27T03:30:00Z');
const transaction = { source: 'ledger', sourceId: 44, occurredAt: instant, type: 'PAYMENT', status: 'POSTED', userId: 7, amount: '-200000.00', balanceAfter: '300000.00', referenceType: 'TOURNAMENT_REGISTRATION', referenceId: 44, description: '=HYPERLINK("bad")', actorId: null, requestType: null };
const topUp = { id: 44, userId: 7, amount: '200000.00', status: 'SUCCESS', provider: 'SEPAY', txnRef: 'SP-44', createdAt: instant, paidAt: instant };
const payout = { id: 44, userId: 7, requestType: 'WITHDRAWAL', amount: '200000.00', status: 'PAID', adminId: 1, adminNote: '+unsafe', transferReference: 'FT-44', createdAt: instant, paidAt: instant };
const refund = { paymentId: 44, bookingId: 12, userId: 7, amount: '200000.00', status: 'FAILED', provider: 'SEPAY', attempts: 2, lastError: '@unsafe', createdAt: instant, updatedAt: instant };
const totals = { cashIn: '500000', cashOut: '100000', grossRevenue: '200000', refunds: '50000', netEstimated: '150000', ownerEarnings: '150000' };
const revenue = { range: '7d', startDate: '2026-11-21', endDate: '2026-11-27', groupBy: 'day', totals, rows: [{ key: '2026-11-27', label: '2026-11-27', gross: '200000', refunds: '50000', net: '150000', ownerEarnings: '150000' }], isEstimate: true };
function fixtures(empty = false) {
  const paged = (row: unknown) => ({ data: empty ? [] : [row], meta: { total: empty ? 0 : 1 } });
  const query = {
    transactions: vi.fn().mockResolvedValue(paged(transaction)), topUps: vi.fn().mockResolvedValue(paged(topUp)),
    payouts: vi.fn().mockResolvedValue(paged(payout)), refunds: vi.fn().mockResolvedValue(paged(refund)),
    revenue: vi.fn().mockResolvedValue({ ...revenue, rows: empty ? [] : revenue.rows }),
    cashFlow: vi.fn().mockResolvedValue({ totals, series: { cashIn: empty ? [] : [{day:'2026-11-27',amount:'500000'}], cashOut: empty ? [] : [{day:'2026-11-27',amount:'100000'}], revenue: empty ? [] : [{day:'2026-11-27',amount:'200000'}] } }),
  };
  const audit = { record: vi.fn().mockResolvedValue({}) };
  const reconciliation = { run: vi.fn().mockResolvedValue({ summary: { truncated: false }, discrepancies: empty ? [] : [{key:'WALLET_BALANCE:7',type:'WALLET_BALANCE',entityType:'WALLET',entityId:'7',expected:'100000',actual:'50000',delta:'-50000',message:'Balance mismatch'}] }) };
  const identities = vi.fn().mockResolvedValue([{id:7,name:'Nguyễn Minh An',email:'an@example.com'},{id:1,name:null,email:'admin@example.com'}]);
  const service = new FinanceExportService(query as unknown as FinanceQueryService, audit as unknown as FinanceAuditService, reconciliation as unknown as ReconciliationService, identities);
  return {service,query,audit,identities};
}
async function open(buffer: Buffer) { const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);return workbook; }
const types = Object.keys(FINANCE_EXPORT_CONFIG) as FinanceExportType[];
describe('Finance export workbook template', () => {
  it.each(types)('keeps overview in summary and exports only table data with audit metadata to %s', async type => {
    const {service,audit,query}=fixtures();
    const result=await service.build(type,{range:'7d',groupBy:'day',userId:7},1);
    const workbook=await open(result.buffer); const sheet=workbook.worksheets[1];
    expect(workbook.getWorksheet('Tổng hợp')).toBeDefined();
    expect(sheet.views[0]).toMatchObject({state:'frozen',ySplit:1,zoomScale:90});
    expect(sheet.getCell('A1').value).toBeTruthy();
    expect(String(sheet.autoFilter)).toMatch(/^A1:/);
    expect(sheet.pageSetup.printTitlesRow).toBe('1:1');
    const values=sheet.getRow(2).values;
    expect(values).toBeTruthy(); expect(result.rowCount).toBe(1);
    expect(sheet.rowCount).toBe(2);
    const summary=workbook.getWorksheet('Tổng hợp')!;
    expect(summary.getCell('A1').text).toContain('SMASHPRO');
    expect(summary.getCell('A2').text).toContain('TỔNG HỢP');
    expect(summary.getColumn(1).values).toContain('Ghi chú');
    for(const col of FINANCE_EXPORT_CONFIG[type].money){
      expect(typeof sheet.getCell(2,col).value).toBe('number');
      expect(sheet.getCell(2,col).numFmt).toContain('₫');
    }
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({actorId:1, action:'EXPORT',entityId:type,metadata:expect.objectContaining({rowCount:1})}));
    if(type==='transactions'){
      expect(sheet.getCell('F2').text).toBe('Nguyễn Minh An\nan@example.com\n#7');
      expect(sheet.getCell('I2').text).toBe('Đăng ký giải đấu #44');
      expect(sheet.getCell('J2').value).toBe('\'=HYPERLINK("bad")');
      expect(sheet.getCell('K2').text).toBe('Hệ thống');
      expect(sheet.getCell('C2').value).toEqual(new Date('2026-11-27T10:30:00Z'));
      expect(query.transactions).toHaveBeenCalledWith(expect.objectContaining({userId:7,page:1,limit:20000}));
    }
    if(type==='payouts')expect(sheet.getCell('G2').value).toBe("'+unsafe");
    if(type==='refunds')expect(sheet.getCell('H2').value).toBe("'@unsafe");
    if(type==='reconciliation')expect(sheet.getCell('G2').value).toBe(-50000);
  });
  it.each(types)('exports an explicit empty state with no sample rows for %s',async type=>{
    const {service}=fixtures(true);const result=await service.build(type,{range:'7d',groupBy:'day'},1);
    const workbook=await open(result.buffer);const sheet=workbook.worksheets[1];
    expect(result.rowCount).toBe(0);expect(sheet.getCell('A2').text).toBe('Không có dữ liệu phù hợp với bộ lọc.');
    expect(sheet.rowCount).toBe(2);
  });
  it('orders daily revenue newest first while preserving each row and its amount',async()=>{
    const {service,query}=fixtures();
    query.revenue.mockResolvedValue({...revenue,rows:[{...revenue.rows[0],key:'2026-11-26',label:'2026-11-26',gross:'100000'},revenue.rows[0]]});
    const workbook=await open((await service.build('revenue',{range:'7d'},1)).buffer);
    const sheet=workbook.worksheets[1];
    expect(sheet.getCell('A2').text).toBe('27/11/2026');expect(sheet.getCell('C2').value).toBe(200000);
    expect(sheet.getCell('A3').text).toBe('26/11/2026');expect(sheet.getCell('C3').value).toBe(100000);
    expect(sheet.rowCount).toBe(3);
  });
  it('preserves owner grouping keys and adds display identity without date sorting',async()=>{
    const {service,query}=fixtures();
    query.revenue.mockResolvedValue({...revenue,groupBy:'owner',rows:[{...revenue.rows[0],key:'7',label:'an@example.com'}]});
    const sheet=(await open((await service.build('revenue',{range:'7d',groupBy:'owner'},1)).buffer)).worksheets[1];
    expect(sheet.getCell('A2').text).toBe('7');expect(sheet.getCell('B2').text).toContain('Nguyễn Minh An');
  });
  it('keeps row limits and unsupported exports from producing an audit success',async()=>{
    const {service,query,audit}=fixtures();query.topUps.mockResolvedValue({data:[topUp],meta:{total:20001}});
    await expect(service.build('top-ups',{},1)).rejects.toMatchObject({code:'FINANCE_EXPORT_TOO_LARGE'});
    await expect(service.build('unknown' as FinanceExportType,{},1)).rejects.toMatchObject({code:'FINANCE_EXPORT_UNSUPPORTED_TYPE'});
    expect(audit.record).not.toHaveBeenCalled();
  });
});
