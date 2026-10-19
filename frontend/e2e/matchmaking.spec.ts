import { test, expect } from '@playwright/test';

const group = { id: 1, matchType: 'DOUBLES', status: 'OPEN', preferredDate: '2030-01-01', preferredStartTime: '10:00', preferredEndTime: '14:00', area: 'Quận 1, TP.HCM', expiresAt: '2030-01-01T03:00:00Z', currentPlayers: 2, requiredPlayers: 4, remainingCount: 2, matchId: null, isOwner: false, invitationId: 5, members: [{ playerId: 1, displayName: 'Chủ nhóm', isOwner: true }, { playerId: 2, displayName: 'Bạn', isOwner: false }] };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: {
    userId: 2, fullName: 'Bạn', avatarUrl: null, skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: null }, ratings: null, stats: null,
  } } }));
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { id: 2, email: 'player@test.test', role: 'PLAYER', requiresPasswordChange: false } } }));
});
test('partial group polls formation and hides withdrawal after matching', async ({ page }) => {
  let formed = false;
  let calls = 0;
  await page.route('**/api/v1/matchmaking-requests/1', route => { calls++; return route.fulfill({json:{data:{...group, status: formed ? 'MATCHED' : 'OPEN', matchId: formed ? 7 : null}}}); });
  await page.goto('/matchmaking/requests/1');
  await expect(page.getByText('2/4 người · Còn thiếu 2 người')).toBeVisible();
  await expect(page.getByRole('button', {name:'Rút khỏi nhóm'})).toBeVisible();
  formed = true;
  await expect(page.getByRole('link', {name:'Xem trận đã hình thành'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Rút khỏi nhóm'})).toHaveCount(0);
  expect(calls).toBeGreaterThan(1);
});
test('withdrawal leaves the revoked group page', async ({ page }) => {
  await page.route('**/api/v1/matchmaking-requests/1', route => route.fulfill({json:{data:group}}));
  await page.route('**/api/v1/matchmaking-invitations/5/withdraw', route => route.fulfill({json:{data:{id:5,status:'WITHDRAWN'}}}));
  await page.route('**/api/v1/matchmaking-invitations?*', route => route.fulfill({json:{data:[],meta:{page:1,totalPages:0,total:0,limit:10}}}));
  await page.goto('/matchmaking/requests/1');
  await page.getByRole('button', {name:'Rút khỏi nhóm'}).click();
  await expect(page).toHaveURL(/matchmaking\/invitations$/);
});
test('match leave requires confirmation and renders cancellation', async ({ page }) => {
  let cancelled = false;
  let commands = 0;
  await page.route('**/api/v1/matches/7', route => route.fulfill({json:{data:{id:7,matchType:'DOUBLES',status:cancelled?'CANCELLED':'PENDING_COURT',scheduledAt:'2030-01-01T03:00:00Z',scheduledEndAt:null,bookingDeadlineAt:'2030-01-01T03:00:00Z',court:null,facility:null,price:null,payer:null,booking:null,players:[],currentPlayers:4,requiredPlayers:4,isOwner:false,cancellationReason:cancelled?'INSUFFICIENT_PLAYERS':null}}}));
  await page.route('**/api/v1/matches/7/leave', route => {commands++;cancelled=true;return route.fulfill({json:{data:{status:'CANCELLED'}}});});
  await page.goto('/matchmaking/matches/7');
  await page.getByRole('button',{name:'Rời trận',exact:true}).click();
  expect(commands).toBe(0);
  await page.getByRole('button',{name:'Xác nhận rời trận'}).click();
  await expect(page.getByText('Một thành viên đã rời trận.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Rời trận',exact:true})).toHaveCount(0);
  expect(commands).toBe(1);
});
test('area selection uses district/city values and restores the last selection', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('matchmaking:lastArea', 'Quận 1, TP.HCM'));
  await page.route('**/api/v1/skill-levels', route => route.fulfill({json:{data:[{id:1,code:'AVERAGE',name:'Trung bình',rank:1}]}}));
  await page.route('**/api/v1/matchmaking-requests?*', route => route.fulfill({json:{data:[],meta:{page:1,totalPages:0,total:0,limit:10}}}));
  await page.route('**/api/v1/courts?*', route => route.fulfill({json:{data:[{facility:{district:'Quận 1',city:'TP.HCM'}},{facility:{district:'Quận 1',city:'TP.HCM'}}],meta:{page:1,totalPages:1,total:2,limit:50}}}));
  await page.goto('/matchmaking');
  await page.getByRole('button',{name:'+ Tạo yêu cầu'}).click();
  await expect(page.locator('select#mm-area')).toBeVisible();
  await expect(page.locator('#mm-area option')).toHaveCount(2);
  await expect(page.locator('#mm-area')).toHaveValue('Quận 1, TP.HCM');
});
test('owner searches candidates, sends an invitation and cancels the request', async ({ page }) => {
  let cancelled = false;
  let invited = false;
  await page.route('**/api/v1/matchmaking-requests/1', route => route.fulfill({json:{data:{...group,isOwner:true,invitationId:null,status:cancelled?'CANCELLED':'OPEN'}}}));
  await page.route('**/api/v1/matchmaking-requests/1/candidates?*', route => route.fulfill({json:{data:invited?[]:[{playerId:3,displayName:'Lan',skill:{name:'Trung bình'},skillMismatch:false}],meta:{page:1,totalPages:1,total:invited?0:1,limit:10}}}));
  await page.route('**/api/v1/matchmaking-requests/1/invitations', route => {expect(route.request().postDataJSON()).toEqual({inviteeId:3});invited=true;return route.fulfill({json:{data:{id:9,status:'PENDING'}}});});
  await page.route('**/api/v1/matchmaking-requests/1/cancel', route => {cancelled=true;return route.fulfill({json:{data:{id:1,status:'CANCELLED'}}});});
  await page.goto('/matchmaking/requests/1');
  await page.getByPlaceholder('Tìm theo tên người chơi').fill('Lan');
  await page.getByRole('button',{name:'Gửi lời mời',exact:true}).click();
  await expect.poll(() => invited).toBe(true);
  await page.getByRole('button',{name:'Hủy yêu cầu',exact:true}).click();
  await expect(page.getByText('Nhóm đã đóng.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Hủy yêu cầu',exact:true})).toHaveCount(0);
});
for (const decision of ['ACCEPTED','DECLINED'] as const) {
  test(`invitation inbox submits ${decision} and refreshes actions`, async ({ page }) => {
    let status: string = 'PENDING';
    await page.route('**/api/v1/matchmaking-invitations?*', route => route.fulfill({json:{data:[{id:5,requestId:1,direction:'RECEIVED',status,matchId:null,expiresAt:'2030-01-01T03:00:00Z',counterpart:{playerId:1,displayName:'Chủ nhóm'},request:{...group}}],meta:{page:1,totalPages:1,total:1,limit:10}}}));
    await page.route('**/api/v1/matchmaking-invitations/5', route => {expect(route.request().postDataJSON()).toEqual({decision});status=decision;return route.fulfill({json:{data:{invitationId:5,requestId:1,status,matchId:null}}});});
    await page.goto('/matchmaking/invitations');
    await page.getByRole('button',{name:decision==='ACCEPTED'?'Chấp nhận':'Từ chối',exact:true}).click();
    await expect(page.getByRole('button',{name:'Chấp nhận',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Rút khỏi nhóm',exact:true})).toHaveCount(decision==='ACCEPTED'?1:0);
  });
}

test('request members and match roster open public profile without mutating the group/match', async ({ page }) => {
  let mutations = 0;
  page.on('request', req => { if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method())) mutations++; });
  await page.route('**/api/v1/matchmaking-requests/1', route => route.fulfill({ json: { data: group } }));
  await page.route('**/api/v1/players/1', route => route.fulfill({ json: { data: {
    userId: 1, fullName: 'Chủ nhóm', avatarUrl: null, skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: null }, ratings: null, stats: null,
  } } }));
  await page.goto('/matchmaking/requests/1');
  const member = page.getByRole('button', { name: 'Xem hồ sơ Chủ nhóm', exact: true }); await member.click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Chủ nhóm', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click(); await expect(member).toBeFocused();
  await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: {
    id: 7, matchType: 'DOUBLES', status: 'CONFIRMED', scheduledAt: '2030-01-01T03:00:00Z', scheduledEndAt: null,
    bookingDeadlineAt: null, court: null, facility: null, price: null, payer: null, booking: null,
    players: [{ playerId: 1, displayName: 'Chủ nhóm', skill: { name: 'Trung bình' }, teamNo: 1, status: 'ACTIVE' }],
    currentPlayers: 4, requiredPlayers: 4, isOwner: false, cancellationReason: null,
  } } }));
  await page.goto('/matchmaking/matches/7'); await page.getByRole('button', { name: 'Xem hồ sơ Chủ nhóm', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Chủ nhóm', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); expect(mutations).toBe(0);
});
test('invitation counterpart opens unavailable public profile without triggering invitation actions', async ({ page }) => {
  let mutations = 0; page.on('request', req => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) mutations++; });
  await page.route('**/api/v1/matchmaking-invitations?*', route => route.fulfill({ json: { data: [{
    id: 9, matchId: null, requestId: 1, direction: 'RECEIVED', status: 'PENDING', expiresAt: '2030-01-01T03:00:00Z',
    counterpart: { playerId: 3, displayName: 'Lan', skill: null }, request: { ...group, status: 'OPEN' },
  }], meta: { page: 1, totalPages: 1, total: 1, limit: 10 } } }));
  await page.route('**/api/v1/players/3', route => route.fulfill({ status: 404, json: { error: { code: 'PLAYER_NOT_FOUND' } } }));
  await page.goto('/matchmaking/invitations'); await page.getByRole('button', { name: 'Xem hồ sơ Lan', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Hồ sơ không khả dụng'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Chấp nhận', exact: true })).toBeEnabled(); expect(mutations).toBe(0);
});
