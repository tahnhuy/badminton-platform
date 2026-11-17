import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: {
    userId: 2, fullName: 'Bạn', avatarUrl: null, skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: null }, ratings: null, stats: null,
  } } }));
  await page.route('**/api/v1/auth/**', route => route.fulfill({ json: { data: { id: 2, email: 'player@test.test', role: 'PLAYER', requiresPasswordChange: false } } }));
  await page.route('**/api/v1/notifications**', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 0 } } }));
  await page.route('**/api/v1/conversations**', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 30, total: 0, totalPages: 0 } } }));
  await page.route('**/api/v1/presence**', route => route.fulfill({ json: { data: null } }));
});

test('pending-court owner picks a paid booking instead of auto-searching a court', async ({ page }) => {
  let linked = false;
  await page.route('**/api/v1/matches/9', route => route.fulfill({ json: { data: {
    id: 9, matchType: 'SINGLES', status: linked ? 'CONFIRMED' : 'PENDING_COURT',
    scheduledAt: '2030-01-01T03:00:00Z', scheduledEndAt: null, bookingDeadlineAt: '2030-01-01T03:00:00Z',
    court: linked ? { id: 5, name: 'Sân 03' } : null, facility: linked ? { id: 1, name: 'CLB Phúc Thịnh', address: '1', ward: null, district: 'Quận 7', city: 'TP.HCM' } : null,
    price: linked ? 100000 : null, payer: linked ? { playerId: 2 } : null,
    booking: linked ? { id: 20, status: 'CONFIRMED' } : null,
    players: [{ playerId: 2, displayName: 'Bạn', skill: null, teamNo: 1, status: 'ACTIVE' }],
    currentPlayers: 1, requiredPlayers: 2, isOwner: true, cancellationReason: null,
  } } }));
  await page.route('**/api/v1/matches/9/booking-candidates', route => route.fulfill({ json: { data: [
    { id: 20, bookingCode: 'BK20', bookingDate: '2030-01-01', startTime: '10:00', endTime: '11:00', totalAmount: 100000, status: 'CONFIRMED', court: { id: 5, name: 'Sân 03' }, facility: { id: 1, name: 'CLB Phúc Thịnh' }, eligible: true, reason: null },
    { id: 21, bookingCode: 'BK21', bookingDate: '2030-01-01', startTime: '12:00', endTime: '13:00', totalAmount: 100000, status: 'CONFIRMED', court: { id: 5, name: 'Sân 03' }, facility: { id: 1, name: 'CLB Phúc Thịnh' }, eligible: false, reason: 'WRONG_WINDOW' },
  ] } }));
  await page.route('**/api/v1/matches/9/booking', route => {
    expect(route.request().postDataJSON()).toEqual({ bookingId: 20 });
    linked = true;
    return route.fulfill({ json: { data: { matchId: 9, status: 'CONFIRMED', bookingId: 20 } } });
  });

  await page.goto('/matchmaking/matches/9');
  await expect(page.getByText('Chọn booking đã thanh toán', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tìm sân cho nhóm' })).toHaveCount(0);
  await expect(page.getByText('Booking không đúng ngày, giờ bắt đầu hoặc thời lượng của kèo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Liên kết' }).nth(1)).toBeDisabled();
  await page.getByRole('button', { name: 'Liên kết' }).first().click();
  await expect.poll(() => linked).toBe(true);
  await expect(page.getByText('Đã có sân', { exact: false })).toBeVisible();
});
