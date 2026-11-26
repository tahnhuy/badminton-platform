import { test, expect } from '@playwright/test';

const matchWindow = {
  date: '2030-01-01',
  startTime: '10:00',
  endTime: '11:00',
  durationMinutes: 60,
};

async function mockShell(page: Parameters<Parameters<typeof test>[2]>[0]) {
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: {
    userId: 2, fullName: 'Bạn', avatarUrl: null, skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: null }, ratings: null, stats: null,
  } } }));
  await page.route('**/api/v1/auth/**', route => route.fulfill({ json: { data: { id: 2, email: 'player@test.test', role: 'PLAYER', requiresPasswordChange: false } } }));
  await page.route('**/api/v1/notifications**', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 0 } } }));
  await page.route('**/api/v1/conversations**', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 30, total: 0, totalPages: 0 } } }));
  await page.route('**/api/v1/presence**', route => route.fulfill({ json: { data: null } }));
}

function matchDetail(created: boolean) {
  return {
    id: 9, matchType: 'SINGLES', status: created ? 'CONFIRMED' : 'PENDING_COURT',
    scheduledAt: '2030-01-01T03:00:00Z', scheduledEndAt: '2030-01-01T04:00:00Z', bookingDeadlineAt: '2030-01-01T03:00:00Z',
    court: created ? { id: 5, name: 'Sân 03' } : null,
    facility: created ? { id: 1, name: 'CLB Phúc Thịnh', address: '1', ward: null, district: 'Quận 7', city: 'TP.HCM' } : null,
    price: created ? 200000 : null,
    payer: created ? { playerId: 2 } : null,
    booking: created ? { id: 20, status: 'CONFIRMED' } : null,
    players: [
      { playerId: 2, displayName: 'Bạn', skill: null, teamNo: 1, status: 'ACTIVE' },
      { playerId: 3, displayName: 'Minh', skill: null, teamNo: 2, status: 'ACTIVE' },
    ],
    currentPlayers: 2, requiredPlayers: 2, isOwner: true, cancellationReason: null,
    bookingWindow: matchWindow,
    costSharing: created ? {
      totalAmount: 200000, memberCount: 2, shareAmount: 100000,
      members: [
        { playerId: 2, displayName: 'Bạn', amount: 100000, status: 'PAID', isHost: true },
        { playerId: 3, displayName: 'Minh', amount: 100000, status: 'PAID', isHost: false },
      ],
    } : null,
  };
}

const court = {
  id: 5, name: 'Sân 03', description: null, priceFrom: 200000, available: true,
  facility: {
    id: 1, name: 'CLB Phúc Thịnh', address: '1', ward: null, district: 'Quận 7', city: 'TP.HCM',
    phone: '0900000000', openingTime: '06:00:00', closingTime: '22:00:00',
  },
};

test('owner places a court from the match window and sees the split result', async ({ page }) => {
  await mockShell(page);
  let created = false;
  await page.route('**/api/v1/matches/9', route => route.fulfill({ json: { data: matchDetail(created) } }));
  await page.route('**/api/v1/facilities?**', route => route.fulfill({ json: {
    data: [{ facility: court.facility, priceFrom: court.priceFrom, courts: [{ id: court.id, name: court.name, description: court.description, priceFrom: court.priceFrom }] }],
    meta: { page: 1, limit: 9, total: 1, totalPages: 1 },
  } }));
  await page.route('**/api/v1/matches/9/booking/preview?**', route => route.fulfill({ json: { data: {
    court: { id: 5, name: 'Sân 03' }, facility: { id: 1, name: 'CLB Phúc Thịnh' }, bookingWindow: matchWindow,
    totalAmount: 200000, memberCount: 2, shareAmount: 100000,
    members: [
      { playerId: 2, displayName: 'Bạn', isHost: true, amount: 100000, sufficient: true, shortfall: 0 },
      { playerId: 3, displayName: 'Minh', isHost: false, amount: 100000, sufficient: true, shortfall: 0 },
    ],
    blockedMembers: [], canBook: true,
  } } }));
  await page.route('**/api/v1/matches/9/booking/create', route => {
    expect(route.request().postDataJSON()).toEqual({ courtId: 5 });
    created = true;
    return route.fulfill({ json: { data: {
      matchId: 9, bookingId: 20, status: 'CONFIRMED', courtId: 5, scheduledAt: '2030-01-01T03:00:00Z',
      totalAmount: 200000, shareAmount: 100000,
      shares: [{ playerId: 2, amount: 100000, isHost: true }, { playerId: 3, amount: 100000, isHost: false }],
    } } });
  });

  await page.goto('/matchmaking/matches/9/book');
  await expect(page.getByRole('heading', { name: 'Đặt sân cho trận #9' })).toBeVisible();
  await expect(page.getByText('10:00 - 11:00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chọn sân này' }).click();
  await expect(page.getByText('Chia đều cho 2 thành viên')).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận đặt sân' }).click();
  await expect(page).toHaveURL(/\/matchmaking\/matches\/9$/);
  await expect(page.getByText('Chia đều cho 2 người')).toBeVisible();
});

test('shows the insufficient-wallet list and lets the owner send a top-up reminder', async ({ page }) => {
  await mockShell(page);
  await page.route('**/api/v1/matches/9', route => route.fulfill({ json: { data: matchDetail(false) } }));
  await page.route('**/api/v1/facilities?**', route => route.fulfill({ json: {
    data: [{ facility: court.facility, priceFrom: court.priceFrom, courts: [{ id: court.id, name: court.name, description: court.description, priceFrom: court.priceFrom }] }],
    meta: { page: 1, limit: 9, total: 1, totalPages: 1 },
  } }));
  await page.route('**/api/v1/matches/9/booking/preview?**', route => route.fulfill({ json: { data: {
    court: { id: 5, name: 'Sân 03' }, facility: { id: 1, name: 'CLB Phúc Thịnh' }, bookingWindow: matchWindow,
    totalAmount: 200000, memberCount: 2, shareAmount: 100000,
    members: [
      { playerId: 2, displayName: 'Bạn', isHost: true, amount: 100000, sufficient: true, shortfall: 0 },
      { playerId: 3, displayName: 'Minh', isHost: false, amount: 100000, sufficient: false, shortfall: 50000 },
    ],
    blockedMembers: [{ playerId: 3, displayName: 'Minh', isHost: false, amount: 100000, shortfall: 50000 }], canBook: false,
  } } }));
  await page.route('**/api/v1/matches/9/booking/remind-topup', route => {
    expect(route.request().postDataJSON()).toEqual({ courtId: 5, playerIds: [3] });
    return route.fulfill({ json: { data: { sent: 1, skipped: 0, recipients: [{ playerId: 3, shortfall: 50000 }] } } });
  });

  await page.goto('/matchmaking/matches/9/book');
  await page.getByRole('button', { name: 'Chọn sân này' }).click();
  await expect(page.getByText('Chưa thể đặt sân — 1 thành viên chưa đủ số dư ví')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận đặt sân' })).toBeDisabled();
  await page.getByRole('button', { name: 'Nhắc nạp ví' }).click();
  await expect(page.getByText('Đã gửi nhắc nạp ví cho 1 thành viên.')).toBeVisible();
});
