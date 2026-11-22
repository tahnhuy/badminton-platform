import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
import type { BookingSummary } from '../src/features/booking/types/booking';
const row = (id: number): BookingSummary => ({ id, bookingCode: `BK-${id}`, status: 'CONFIRMED', bookingDate: '2026-12-01', startTime: '18:00', endTime: '19:00', durationMinutes: 60, totalAmount: 80000, unitPrice: 80000,
  expiresAt: null, refundStatus: 'NONE', court: { id: 1, name: 'Sân 01' }, facility: { id: 1, name: 'CLB Cầu Lông', address: '18 Đường Mẫu', ward: null, district: 'Quận 7', city: 'Hồ Chí Minh' }, createdAt: '2026-11-19T03:00:00Z' });
async function openHistory(page: Page, override?: (route: Route) => Promise<void> | void) {
  const requests: URLSearchParams[] = [];
  await mockAuthApi(page, { user: account(), handlers: { '/api/v1/bookings/my-bookings': route => {
    const query = new URL(route.request().url()).searchParams; requests.push(query); if (override) return override(route);
    const current = Number(query.get('page')); return route.fulfill({ json: { data: [row(current)], meta: { page: current, limit: 10, total: 21, totalPages: 3 } } });
  } } });
  await page.goto('/bookings'); return requests;
}
for (const width of [390,1280]) test(`history ${width}: card content, original detail destination and no overflow`, async ({ page }) => {
  await page.setViewportSize({width,height:900});const log=await openHistory(page);
  const card=page.getByRole('article',{name:'Đơn BK-1'});await expect(card).toBeVisible();await expect(card).toContainText('80.000đ');
  expect(log[0].get('limit')).toBe('10');expect(log[0].has('status')).toBe(false);expect(log[0].has('timeScope')).toBe(false);
  await expect(page.getByRole('link',{name:'Đặt sân mới'})).toHaveAttribute('href','/courts');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  await card.getByRole('button',{name:'Xem chi tiết'}).click();await expect(page).toHaveURL('/bookings/1');
});
test('filter choices preserve backend parameters and reset page one', async ({page})=>{
  const log=await openHistory(page);await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button',{name:'Sau',exact:true}).click();await expect(page.getByText('Trang 2 / 3')).toBeVisible();
  const filters=page.getByRole('group',{name:'Lọc đơn đặt sân'});
  for(const [label,key,value] of [['Sắp diễn ra','timeScope','UPCOMING'],['Chờ thanh toán','status','PENDING_PAYMENT'],['Đã hoàn thành','status','COMPLETED'],['Đã hủy / Hoàn tiền','status','CANCELLED'],['Tất cả','','']]){
    await filters.getByRole('button',{name:label,exact:true}).click();await expect(filters.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>log.at(-1)?.get('page')).toBe('1');
    if(key)await expect.poll(()=>log.at(-1)?.get(key)).toBe(value);else{expect(log.at(-1)?.has('status')).toBe(false);expect(log.at(-1)?.has('timeScope')).toBe(false);}
  }
});
test('pager keeps previous/next boundaries',async({page})=>{
  await openHistory(page);await expect(page.getByRole('button',{name:'Trước',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Sau',exact:true}).click();await expect(page.getByText('Trang 2 / 3')).toBeVisible();
  await page.getByRole('button',{name:'Sau',exact:true}).click();await expect(page.getByText('Trang 3 / 3')).toBeVisible();await expect(page.getByRole('button',{name:'Sau',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Trước',exact:true}).click();await expect(page.getByText('Trang 2 / 3')).toBeVisible();
});
test('empty category keeps the exploration action and hides pager',async({page})=>{
  await openHistory(page,route=>route.fulfill({json:{data:[],meta:{page:1,limit:10,total:0,totalPages:1}}}));
  await expect(page.getByRole('heading',{name:'Chưa có đơn đặt sân'})).toBeVisible();await expect(page.getByRole('navigation',{name:'Phân trang lịch sử đặt sân'})).toHaveCount(0);
  await page.getByRole('button',{name:'Khám phá sân'}).click();await expect(page).toHaveURL('/courts');
});
test('initial error retries the same filter and page',async({page})=>{
  let fail=true;const log=await openHistory(page,route=>fail?route.fulfill({status:503,json:{error:{code:'UNAVAILABLE',message:'Tạm gián đoạn.'}}}):route.fulfill({json:{data:[row(1)],meta:{page:1,limit:10,total:1,totalPages:1}}}));
  await expect(page.getByRole('heading',{name:'Không tải được danh sách'})).toBeVisible();fail=false;await page.getByRole('button',{name:'Thử lại'}).click();await expect(page.getByRole('article')).toHaveCount(1);expect(log.at(-1)?.get('page')).toBe('1');
});
