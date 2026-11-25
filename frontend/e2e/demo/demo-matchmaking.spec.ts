import { test, expect, type BrowserContext } from '@playwright/test';
import {
  apiRaw,
  apiRequest,
  chooseSelectOption,
  closeRequest,
  conversationMessages,
  createMatchPost,
  invitePlayer,
  notificationTypes,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  respondInvitation,
  sendChatMessage,
  skillLevels,
  vnIso,
  type RegisteredAccount,
} from '../e2e-helpers';

async function newPlayer(browser: import('@playwright/test').Browser, email: string, fullName: string) {
  const context = await browser.newContext();
  const account = await registerAccount(context, { email, fullName });
  const page = await context.newPage();
  return { context, page, account };
}

async function inviteAndAccept(
  hostContext: BrowserContext,
  requestId: number,
  memberContext: BrowserContext,
  member: RegisteredAccount
): Promise<void> {
  const invitationId = await invitePlayer(hostContext, requestId, member.id);
  await respondInvitation(memberContext, invitationId, 'ACCEPTED');
}

async function averageLevelId(context: BrowserContext): Promise<number> {
  const levels = await skillLevels(context);
  return (levels.find((level) => level.rank === 4) ?? levels[0]).id;
}

test.describe('Demo: matchmaking', () => {
  test.beforeEach(async () => {
    await resetDatabase();
    await resetSystemConfigs();
  });

  test('apply + invite + host close creates the match and the linked group chat', async ({ browser }) => {
    test.setTimeout(180_000);
    const host = await newPlayer(browser, 'demo_mm_host@example.com', 'Chủ Kèo Demo');
    const member2 = await newPlayer(browser, 'demo_mm_member2@example.com', 'Người Chơi Hai');
    const member3 = await newPlayer(browser, 'demo_mm_member3@example.com', 'Người Chơi Ba');
    const levelId = await averageLevelId(host.context);

    // GROUP: capacity 4, minimum 3 → host + two accepted players is enough to close.
    const { requestId, postId } = await createMatchPost(host.context, {
      matchType: 'GROUP',
      startAt: vnIso(2, '10:00'),
      minSkillLevelId: levelId,
      maxSkillLevelId: levelId,
      capacity: 4,
      minPlayers: 3,
      body: 'Kèo giao lưu E2E',
    });

    // Flow 5: another player filters the discovery list and applies.
    await member2.page.goto('/matchmaking');
    await expect(member2.page.getByRole('heading', { name: 'Tìm đối thủ', exact: true })).toBeVisible();
    await chooseSelectOption(member2.page.getByRole('combobox', { name: 'Trình độ' }), String(levelId));
    await expect(member2.page.getByText(/1 kèo phù hợp/)).toBeVisible();
    await member2.page.getByRole('link', { name: 'Xem kèo' }).first().click();
    await expect(member2.page).toHaveURL(new RegExp(`/posts/${postId}$`));
    await member2.page.getByRole('button', { name: 'Xin tham gia', exact: true }).click();
    await expect(member2.page.getByText('Đã gửi yêu cầu', { exact: false }).first()).toBeVisible();

    // Host approves the application.
    await host.page.goto(`/matchmaking/requests/${requestId}`);
    await expect(host.page.getByRole('heading', { name: 'Quản lý kèo', exact: true })).toBeVisible();
    await host.page.getByRole('tab', { name: /Yêu cầu tham gia/ }).click();
    await host.page.getByRole('button', { name: 'Duyệt yêu cầu', exact: true }).first().click();
    await host.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(host.page.getByText('Đã duyệt người chơi.')).toBeVisible();

    // Host invites the third player, who accepts from the activity inbox.
    await host.page.getByRole('button', { name: 'Mời người chơi', exact: true }).click();
    const inviteDialog = host.page.getByRole('dialog');
    await inviteDialog.getByLabel('Tìm theo tên người chơi').fill(member3.account.fullName);
    await expect(inviteDialog.getByText(member3.account.fullName)).toBeVisible();
    await inviteDialog.getByRole('button', { name: 'Gửi lời mời' }).first().click();
    await expect(host.page.getByText('Đã gửi lời mời', { exact: false }).first()).toBeVisible();

    await member3.page.goto('/matchmaking/activity#invitations');
    await member3.page.getByRole('button', { name: 'Chấp nhận', exact: true }).first().click();
    await expect
      .poll(async () => {
        const invitations = await apiRequest<{ data: Array<{ status: string }> }>(
          member3.context,
          'GET',
          '/matchmaking-invitations?direction=RECEIVED'
        );
        return invitations.data[0]?.status;
      })
      .toBe('ACCEPTED');

    // Host manually closes the roster → Match is created.
    await host.page.reload();
    await host.page.getByRole('button', { name: /Chốt kèo/ }).first().click();
    await host.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();

    await expect
      .poll(async () => {
        const detail = await apiRequest<{ data: { status: string } }>(
          host.context,
          'GET',
          `/matchmaking-requests/${requestId}`
        );
        return detail.data.status;
      })
      .toBe('MATCHED');
    const afterClose = await apiRequest<{ data: { status: string; matchId: number | null } }>(
      host.context,
      'GET',
      `/matchmaking-requests/${requestId}`
    );
    const matchId = afterClose.data.matchId;
    expect(matchId).toBeTruthy();

    await host.page.goto(`/matchmaking/matches/${matchId}`);
    await expect(host.page.getByRole('heading', { name: 'Chi tiết trận giao lưu', exact: true })).toBeVisible();
    await expect(host.page.getByText('Chờ đặt sân', { exact: true }).first()).toBeVisible();
    await expect(host.page.getByText(member2.account.fullName).first()).toBeVisible();
    await expect(host.page.getByText(member3.account.fullName).first()).toBeVisible();

    // Linked group chat: the system creates it with all accepted members.
    await host.page.goto(`/matchmaking/requests/${requestId}`);
    await host.page.getByRole('button', { name: 'Tạo nhóm chat', exact: true }).click();
    await expect
      .poll(async () => {
        const detail = await apiRequest<{ data: { conversationId: number | null } }>(
          host.context,
          'GET',
          `/matchmaking-requests/${requestId}`
        );
        return detail.data.conversationId;
      })
      .not.toBeNull();
    const detail = await apiRequest<{ data: { conversationId: number } }>(
      host.context,
      'GET',
      `/matchmaking-requests/${requestId}`
    );
    const conversationId = detail.data.conversationId;
    const conversation = await apiRequest<{ data: { members: Array<{ state: string }> } }>(
      host.context,
      'GET',
      `/conversations/${conversationId}`
    );
    expect(conversation.data.members.filter((member) => member.state === 'ACTIVE')).toHaveLength(3);

    await sendChatMessage(host.context, conversationId, 'Chào cả nhóm');
    const messages = await conversationMessages(member2.context, conversationId);
    expect(messages.some((message) => message.body === 'Chào cả nhóm')).toBe(true);

    // Notifications at the matchmaking steps (flow 9).
    expect(await notificationTypes(member2.context)).toEqual(
      expect.arrayContaining(['MM_APPLICATION_ACCEPTED', 'MM_MEMBERSHIP_CHANGED', 'MM_POST_CLOSED'])
    );
    expect(await notificationTypes(member3.context)).toEqual(
      expect.arrayContaining(['MM_INVITATION_RECEIVED', 'MM_POST_CLOSED'])
    );

    await host.context.close();
    await member2.context.close();
    await member3.context.close();
  });

  test('close conditions: Singles 2, Doubles 4 and the GROUP minimum', async ({ browser }) => {
    test.setTimeout(180_000);
    const host = await newPlayer(browser, 'demo_mm_close_host@example.com', 'Chủ Kèo Điều Kiện');
    const m1 = await newPlayer(browser, 'demo_mm_close_1@example.com', 'Người Một');
    const m2 = await newPlayer(browser, 'demo_mm_close_2@example.com', 'Người Hai');
    const m3 = await newPlayer(browser, 'demo_mm_close_3@example.com', 'Người Ba');
    const levelId = await averageLevelId(host.context);

    // Singles with only the host cannot close.
    const emptySingles = await createMatchPost(host.context, {
      matchType: 'SINGLES',
      startAt: vnIso(3, '10:00'),
      minSkillLevelId: levelId,
      maxSkillLevelId: levelId,
    });
    const singlesTooEarly = await apiRaw(host.context, 'POST', `/matchmaking-requests/${emptySingles.requestId}/close`);
    expect(singlesTooEarly.status()).toBe(409);
    expect((await singlesTooEarly.json()).error.code).toBe('MATCHMAKING_EARLY_CLOSE_NOT_ALLOWED');
    await apiRequest(host.context, 'POST', `/matchmaking-requests/${emptySingles.requestId}/cancel`, { bookingAction: 'KEEP' });

    // Singles with 2 players closes.
    const singles = await createMatchPost(host.context, {
      matchType: 'SINGLES',
      startAt: vnIso(3, '14:00'),
      minSkillLevelId: levelId,
      maxSkillLevelId: levelId,
    });
    await inviteAndAccept(host.context, singles.requestId, m1.context, m1.account);
    expect(await closeRequest(host.context, singles.requestId)).toBeTruthy();
    await apiRequest(host.context, 'POST', `/matchmaking-requests/${singles.requestId}/cancel`, { bookingAction: 'KEEP' });

    // Doubles needs 4 players. With only the host the UI disables the close button.
    const doubles = await createMatchPost(host.context, {
      matchType: 'DOUBLES',
      startAt: vnIso(4, '10:00'),
      minSkillLevelId: levelId,
      maxSkillLevelId: levelId,
    });
    await host.page.goto(`/matchmaking/requests/${doubles.requestId}`);
    await expect(host.page.getByRole('button', { name: /Chốt kèo/ }).first()).toBeDisabled();
    await expect(host.page.getByText(/Chưa đủ người để chốt kèo/)).toBeVisible();
    const doublesTooEarly = await apiRaw(host.context, 'POST', `/matchmaking-requests/${doubles.requestId}/close`);
    expect(doublesTooEarly.status()).toBe(409);

    for (const member of [m1, m2, m3]) {
      await inviteAndAccept(host.context, doubles.requestId, member.context, member.account);
    }
    expect(await closeRequest(host.context, doubles.requestId)).toBeTruthy();
    await apiRequest(host.context, 'POST', `/matchmaking-requests/${doubles.requestId}/cancel`, { bookingAction: 'KEEP' });

    // GROUP needs the configured minimum (3) and at least one non-host player.
    const group = await createMatchPost(host.context, {
      matchType: 'GROUP',
      startAt: vnIso(5, '10:00'),
      minSkillLevelId: levelId,
      maxSkillLevelId: levelId,
      capacity: 4,
      minPlayers: 3,
    });
    await inviteAndAccept(host.context, group.requestId, m1.context, m1.account);
    const groupTooEarly = await apiRaw(host.context, 'POST', `/matchmaking-requests/${group.requestId}/close`);
    expect(groupTooEarly.status()).toBe(409);
    await inviteAndAccept(host.context, group.requestId, m2.context, m2.account);
    expect(await closeRequest(host.context, group.requestId)).toBeTruthy();

    await host.context.close();
    await m1.context.close();
    await m2.context.close();
    await m3.context.close();
  });
});
