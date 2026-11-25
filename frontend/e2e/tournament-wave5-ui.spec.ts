import { expect, test, type Route } from '@playwright/test';
import { mockTournamentApi, tournament } from './tournament-fixtures';

/** TRN-14/16/18 contract UI tests (mocked API). The signed-in user has id 1. */
test.use({ viewport: { width: 1280, height: 900 } });
const json = (route: Route, data: unknown, meta?: unknown) => route.fulfill({ json: meta ? { data, meta } : { data } });
const person = (id: number, fullName: string) => ({ id, fullName, avatarUrl: null, level: { id: 2, name: 'Trung bình', rank: 4 } });

test('rankings page shows the podium and switches to Doubles', async ({ page }) => {
  const asked: string[] = [];
  await mockTournamentApi(page, { extra: {
    '/api/v1/tournament-rankings': route => {
      const url = new URL(route.request().url());
      asked.push(url.searchParams.get('matchType')!);
      const rows = url.searchParams.get('matchType') === 'DOUBLES' ? [] : [
        { position: 1, player: person(11, 'An Nguyễn'), totalPoints: 250, tournamentsCounted: 3, bestPoints: 100 },
        { position: 2, player: person(12, 'Bình Trần'), totalPoints: 180, tournamentsCounted: 2, bestPoints: 100 },
        { position: 3, player: person(13, 'Cường Lê'), totalPoints: 120, tournamentsCounted: 2, bestPoints: 70 },
        { position: 4, player: person(14, 'Dũng Phạm'), totalPoints: 60, tournamentsCounted: 1, bestPoints: 60 },
      ];
      return json(route, rows, { page: 1, limit: 20, total: rows.length, totalPages: 1, bestN: 4, windowMonths: 12 });
    },
  } });
  await page.goto('/tournaments');
  await page.getByRole('link', { name: 'Bảng xếp hạng' }).click();
  await expect(page).toHaveURL('/tournaments/rankings');
  const podium = page.getByRole('list', { name: 'Top 3' });
  await expect(podium).toContainText('An Nguyễn');
  await expect(podium).toContainText('250 điểm');
  await expect(page.getByText('Dũng Phạm')).toBeVisible();
  await page.getByRole('tab', { name: 'Đôi' }).click();
  await expect(page.getByText('Chưa có ai trên bảng xếp hạng')).toBeVisible();
  expect(asked).toEqual(['SINGLES', 'DOUBLES']);
});

test('a completed tournament can be shared and links the group chat', async ({ page }) => {
  let shared: unknown = null;
  await mockTournamentApi(page, {
    finalDone: true,
    detail: { ...tournament({ status: 'COMPLETED', completedAt: '2026-12-05T14:00:00.000Z', viewer: { isOrganizer: false, registrationId: 1, eligible: true, ineligibleReason: null, canShare: true, sharedPostId: null } }), conversationId: 55 } as never,
    extra: {
      '/api/v1/tournaments/7/share': route => { shared = route.request().postDataJSON(); return json(route, { postId: 901 }); },
      '/api/v1/posts/901': route => json(route, null),
    },
  });
  await page.goto('/tournaments/7');
  await expect(page.getByRole('link', { name: 'Nhóm chat giải' })).toHaveAttribute('href', '/messages/55');
  await page.getByRole('button', { name: 'Chia sẻ kết quả' }).click();
  await page.getByLabel('Lời chia sẻ').fill('Vô địch rồi!');
  await page.getByRole('dialog').getByRole('button', { name: 'Chia sẻ' }).click();
  await expect(page).toHaveURL('/posts/901');
  expect(shared).toEqual({ body: 'Vô địch rồi!' });
});

test('the feed renders a tournament result card from the tournament data', async ({ page }) => {
  const post = {
    id: 901, type: 'TOURNAMENT_RESULT', title: null, body: 'Một giải thật vui!', background: null,
    author: { id: 11, displayName: 'An Nguyễn', avatarUrl: null, skillLevel: { id: 2, name: 'Trung bình' } }, isAuthor: false,
    publishedAt: '2026-12-05T15:00:00.000Z', editedAt: null, isEdited: false, createdAt: '2026-12-05T15:00:00.000Z', images: [],
    reactions: { counts: {}, total: 0, viewerReaction: null }, commentCount: 0, recruitment: null,
    tournamentResult: { tournament: { id: 7, name: 'Giải đơn mùa đông 2026', matchType: 'SINGLES', completedAt: '2026-12-05T14:00:00.000Z', tournamentEnd: '2026-12-05T14:00:00.000Z' }, champion: 'An Nguyễn', runnerUp: 'Bình Trần', authorPlacement: 'CHAMPION' },
  };
  await mockTournamentApi(page, { extra: {
    '/api/v1/posts': route => json(route, [post], { page: 1, limit: 20, total: 1, totalPages: 1, asOf: '2026-12-06T00:00:00.000Z' }),
  } });
  await page.goto('/feed');
  const card = page.getByRole('article', { name: /An Nguyễn/ });
  await expect(card.getByRole('link', { name: 'Giải đơn mùa đông 2026' })).toHaveAttribute('href', '/tournaments/7');
  await expect(card).toContainText('Vô địch · Đơn');
  await expect(card).toContainText('Bình Trần');
  await expect(card).toContainText('Một giải thật vui!');
});

test('own profile shows the private skill rating and tournament history', async ({ page }) => {
  await mockTournamentApi(page, { extra: {
    '/api/v1/players/me/skill-rating': route => json(route, {
      rating: 57.4, tentative: true, ratedMatchCount: 3, level: { id: 2, name: 'Trung bình', rank: 4 }, band: { min: 45, max: 60 },
      next: { name: 'Trung bình khá', threshold: 63, remaining: 5.6 }, previous: { name: 'Trung bình yếu', threshold: 42 },
      events: [{ tournament: { id: 7, name: 'Giải đơn mùa đông 2026' }, tournamentMatchId: 101, before: 54.2, after: 57.4, opponent: 60, expected: 0.39, outcome: 1, at: '2026-12-05T14:00:00.000Z' }],
      changes: [],
    }),
    '/api/v1/players/1/tournaments': route => json(route, [{
      tournament: { id: 7, name: 'Giải đơn mùa đông 2026', matchType: 'SINGLES', tournamentStart: '2026-12-05T01:00:00.000Z', completedAt: '2026-12-05T14:00:00.000Z' },
      placement: 'CHAMPION', teamName: null, partner: null, rankingPoints: 100,
    }], { page: 1, limit: 10, total: 1, totalPages: 1 }),
    '/api/v1/tournament-rankings/players/1': route => json(route, { SINGLES: { position: 3, totalPoints: 100, tournamentsCounted: 1 }, DOUBLES: null }),
  } });
  await page.goto('/profile');
  const rating = page.getByRole('region', { name: 'Điểm phong độ' });
  await expect(rating).toContainText('57.4');
  await expect(rating).toContainText('Chỉ bạn nhìn thấy điểm này');
  await expect(rating).toContainText('Còn 5.6 điểm để lên Trung bình khá');
  await expect(rating).toContainText('+3.20');
  const history = page.getByRole('region', { name: 'Giải đấu' });
  await expect(history).toContainText('Giải đơn mùa đông 2026');
  await expect(history).toContainText('Vô địch');
  await expect(history).toContainText('+100 điểm');
  await expect(history.getByRole('link', { name: /Đơn: hạng #3/ })).toBeVisible();
});
