import { expect, test, type Route } from '@playwright/test';
import { mockTournamentApi, tournament } from './tournament-fixtures';

/** TRN-09 contract UI tests for Doubles teams (mocked API). The signed-in user has id 1. */
test.use({ viewport: { width: 1280, height: 900 } });
const me = { id: 1, fullName: 'D01 Player', avatarUrl: null };
const partner = { id: 21, fullName: 'Hà Vy', avatarUrl: null };
const base = '/api/v1/tournaments/7';
const doubles = (overrides: Record<string, unknown> = {}) => tournament({ matchType: 'DOUBLES', ...overrides });
const team = (overrides: Record<string, unknown> = {}) => ({
  id: 31, tournamentId: 7, name: 'Song Kiếm', status: 'FORMING', captainId: 1, hasInviteLink: false, registrationId: null, pendingInvitation: null,
  members: [{ ...me, role: 'CAPTAIN', skillLevel: { name: 'Trung bình', rank: 4 } }], ...overrides,
});
const json = (route: Route, data: unknown, status = 200) => route.fulfill({ status, json: { data } });

test('creates a team, finds a partner and invites them', async ({ page }) => {
  let current: unknown = { team: null, invitations: [] };
  const bodies: unknown[] = [];
  await mockTournamentApi(page, { detail: doubles(), extra: {
    [`${base}/teams/mine`]: route => json(route, current),
    [`${base}/teams`]: route => { bodies.push(route.request().postDataJSON()); current = { team: team(), invitations: [] }; return json(route, team(), 201); },
    [`${base}/invitable-players`]: route => json(route, [{ ...partner, skillLevel: { name: 'Trung bình', rank: 4 } }]),
    [`${base}/teams/31/invitations`]: route => {
      bodies.push(route.request().postDataJSON());
      const invitation = { id: 41, status: 'PENDING', expiresAt: '2026-11-26T03:00:00.000Z', createdAt: '2026-11-25T03:00:00.000Z', team: { id: 31, name: 'Song Kiếm', tournamentId: 7 }, inviter: me, invitee: partner };
      current = { team: team({ pendingInvitation: invitation }), invitations: [] };
      return json(route, invitation, 201);
    },
  } });
  await page.goto('/tournaments/7');
  await page.getByRole('button', { name: /Lập đội & đăng ký/ }).click();
  await expect(page.locator('#team-panel')).toBeInViewport();
  await page.getByLabel('Tên đội').fill('Song Kiếm');
  await page.getByRole('button', { name: 'Lập đội', exact: true }).click();
  await expect(page.getByText('Đang tìm đồng đội')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Đăng ký đội/ })).toBeDisabled();
  await page.getByLabel('Tìm đồng đội theo tên').fill('Vy');
  await page.getByRole('list', { name: 'Kết quả tìm kiếm' }).getByRole('button', { name: 'Mời' }).click();
  await expect(page.getByText(/Đã mời/)).toContainText('Hà Vy');
  expect(bodies).toEqual([{ name: 'Song Kiếm' }, { inviteeId: 21 }]);
});

test('an invited player accepts from the tournament page', async ({ page }) => {
  let accepted = false;
  const invitation = { id: 41, status: 'PENDING', expiresAt: '2026-11-26T03:00:00.000Z', createdAt: '2026-11-25T03:00:00.000Z', team: { id: 31, name: 'Song Kiếm', tournamentId: 7 }, inviter: partner, invitee: me };
  await mockTournamentApi(page, { detail: doubles(), extra: {
    [`${base}/teams/mine`]: route => json(route, accepted
      ? { team: team({ status: 'FULL', captainId: 21, members: [{ ...partner, role: 'CAPTAIN', skillLevel: null }, { ...me, role: 'MEMBER', skillLevel: null }] }), invitations: [] }
      : { team: null, invitations: [invitation] }),
    '/api/v1/tournaments/invitations/41/accept': route => { accepted = true; return json(route, {}); },
  } });
  await page.goto('/tournaments/7');
  await expect(page.getByRole('list', { name: 'Lời mời vào đội' })).toContainText('Hà Vy');
  await page.getByRole('button', { name: 'Nhận lời' }).click();
  await expect(page.getByText('Đang chờ đội trưởng đăng ký và trả lệ phí.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Đăng ký đội/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rời đội' })).toBeVisible();
});

test('the captain registers a full team with the wallet', async ({ page }) => {
  let body: unknown = null;
  await mockTournamentApi(page, { detail: doubles(), extra: {
    [`${base}/teams/mine`]: route => json(route, { team: team({ status: 'FULL', members: [{ ...me, role: 'CAPTAIN', skillLevel: null }, { ...partner, role: 'MEMBER', skillLevel: null }] }), invitations: [] }),
    [`${base}/registrations`]: route => {
      if (route.request().method() === 'POST') { body = route.request().postDataJSON(); return json(route, { id: 77, registrationType: 'DOUBLES' }, 201); }
      return json(route, []);
    },
  } });
  await page.goto('/tournaments/7');
  await page.getByRole('button', { name: /^Đăng ký đội/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký giải' });
  await expect(dialog).toContainText(/400\.000/);
  await dialog.getByRole('button', { name: /Xác nhận/ }).click();
  await expect(dialog).toHaveCount(0);
  expect(body).toEqual({ teamId: 31 });
});

test('the join page previews the team and joins', async ({ page }) => {
  let joined = false;
  await mockTournamentApi(page, { detail: doubles(), extra: {
    '/api/v1/tournaments/teams/join/tok_abcdefghijklmnop': route => {
      if (route.request().method() === 'POST') { joined = true; return json(route, team({ status: 'FULL' })); }
      return json(route, { tournament: { id: 7, name: 'Giải đôi mùa đông', status: 'OPEN_FOR_REGISTRATION', entryFee: 100000, tournamentStart: '2026-12-05T01:00:00.000Z' },
        team: { id: 31, name: 'Song Kiếm', status: 'FORMING', captain: partner }, canJoin: true, reason: null });
    },
    [`${base}/teams/mine`]: route => json(route, { team: null, invitations: [] }),
  } });
  await page.goto('/tournaments/join/tok_abcdefghijklmnop');
  await expect(page.getByRole('heading', { name: 'Song Kiếm' })).toBeVisible();
  await expect(page.getByText('Hà Vy')).toBeVisible();
  await page.getByRole('button', { name: 'Vào đội' }).click();
  await expect(page).toHaveURL('/tournaments/7');
  expect(joined).toBe(true);
});

test('an invalid link explains what to do', async ({ page }) => {
  await mockTournamentApi(page, { extra: {
    '/api/v1/tournaments/teams/join/bad_token_value_123': route => route.fulfill({ status: 404, json: { error: { code: 'TOURNAMENT_TEAM_INVITE_INVALID', message: 'x', details: [] } } }),
  } });
  await page.goto('/tournaments/join/bad_token_value_123');
  await expect(page.getByText('Link mời không còn hiệu lực')).toBeVisible();
});
