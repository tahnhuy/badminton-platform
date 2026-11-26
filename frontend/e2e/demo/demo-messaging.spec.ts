import { test, expect, type Page } from '@playwright/test';
import {
  apiRaw,
  apiRequest,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  type RegisteredAccount,
} from '../e2e-helpers';

async function newPlayer(browser: import('@playwright/test').Browser, email: string, fullName: string) {
  const context = await browser.newContext();
  const account = await registerAccount(context, { email, fullName });
  const page = await context.newPage();
  return { context, page, account };
}

async function directConversation(hostContext: import('@playwright/test').BrowserContext, other: RegisteredAccount): Promise<number> {
  const response = await apiRequest<{ data: { id: number } }>(hostContext, 'POST', '/conversations/direct', {
    playerId: other.id,
  });
  return response.data.id;
}

async function unreadTotal(context: import('@playwright/test').BrowserContext): Promise<number> {
  const response = await apiRequest<{ data: { totalUnread: number } }>(context, 'GET', '/conversations/unread-summary');
  return response.data.totalUnread;
}

async function sendText(page: Page, text: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Nội dung tin nhắn' }).fill(text);
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
}

test.describe('Demo: messaging', () => {
  test.beforeEach(async () => {
    await resetDatabase();
    await resetSystemConfigs();
  });

  test('direct chat: realtime delivery, typing, online, reaction and unread counts', async ({ browser }) => {
    test.setTimeout(180_000);
    const an = await newPlayer(browser, 'demo_msg_an@example.com', 'An Nguyễn');
    const binh = await newPlayer(browser, 'demo_msg_binh@example.com', 'Bình Trần');
    const conversationId = await directConversation(an.context, binh.account);

    await an.page.goto(`/messages/${conversationId}`);
    await binh.page.goto(`/messages/${conversationId}`);
    await expect(an.page.getByRole('textbox', { name: 'Nội dung tin nhắn' })).toBeVisible();
    await expect(binh.page.getByRole('textbox', { name: 'Nội dung tin nhắn' })).toBeVisible();

    // Online presence (heartbeat on mount).
    await expect(binh.page.getByText('Đang hoạt động').first()).toBeVisible({ timeout: 20_000 });

    // Typing indicator first (the client throttles typing to one send per 3s, so checking it
    // before any other composer activity keeps the signal deterministic).
    const composer = an.page.getByRole('textbox', { name: 'Nội dung tin nhắn' });
    await composer.click();
    await composer.pressSequentially('dang go thu', { delay: 80 });
    await expect(binh.page.getByText(/đang nhập tin nhắn/)).toBeVisible({ timeout: 15_000 });

    // Realtime text without reload; the message also clears the typing indicator.
    await sendText(an.page, 'Xin chào Bình');
    await expect(binh.page.getByRole('region', { name: 'Nội dung cuộc trò chuyện' }).getByText('Xin chào Bình', { exact: true })).toBeVisible({ timeout: 15_000 });

    await sendText(an.page, 'Tin để thả cảm xúc');
    await expect(binh.page.getByRole('region', { name: 'Nội dung cuộc trò chuyện' }).getByText('Tin để thả cảm xúc', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Reaction propagates in real time.
    const bubble = binh.page.locator('[id^="msg-item-"]').filter({ hasText: 'Tin để thả cảm xúc' }).first();
    await bubble.getByRole('button', { name: 'Bày tỏ cảm xúc' }).click();
    await binh.page.getByRole('button', { name: 'Thích', exact: true }).click();
    await expect(an.page.getByRole('button', { name: /👍\s*1/ }).first()).toBeVisible({ timeout: 15_000 });

    // Unread count appears while the recipient is not in the room, then clears on read.
    await binh.page.goto('/messages');
    await expect.poll(() => unreadTotal(binh.context)).toBe(0);
    await sendText(an.page, 'Tin chưa đọc');
    await expect.poll(() => unreadTotal(binh.context)).toBeGreaterThanOrEqual(1);
    await binh.page.goto(`/messages/${conversationId}`);
    await expect(binh.page.getByRole('region', { name: 'Nội dung cuộc trò chuyện' }).getByText('Tin chưa đọc', { exact: true })).toBeVisible();
    await expect.poll(() => unreadTotal(binh.context)).toBe(0);

    await an.context.close();
    await binh.context.close();
  });

  test('group chat with image and file attachments', async ({ browser }) => {
    test.setTimeout(180_000);
    const an = await newPlayer(browser, 'demo_group_an@example.com', 'An Nhóm');
    const binh = await newPlayer(browser, 'demo_group_binh@example.com', 'Bình Nhóm');

    await an.page.goto('/messages');
    await an.page.getByRole('button', { name: 'Tạo nhóm', exact: true }).click();
    const dialog = an.page.getByRole('dialog');
    await dialog.getByLabel('Tên nhóm').fill('Nhóm E2E');
    await dialog.getByLabel(/Tìm và chọn thành viên/).fill('Bình Nhóm');
    await dialog.getByRole('checkbox', { name: /Bình Nhóm/ }).check();
    await dialog.getByRole('button', { name: 'Tạo nhóm chat', exact: true }).click();

    await expect
      .poll(async () => {
        const conversations = await apiRequest<{ data: Array<{ id: number; title: string | null }> }>(
          an.context,
          'GET',
          '/conversations?limit=50'
        );
        return conversations.data.find((row) => row.title === 'Nhóm E2E')?.id ?? null;
      })
      .not.toBeNull();
    const conversations = await apiRequest<{ data: Array<{ id: number; title: string | null }> }>(
      an.context,
      'GET',
      '/conversations?limit=50'
    );
    const conversationId = conversations.data.find((row) => row.title === 'Nhóm E2E')!.id;

    await binh.page.goto(`/messages/${conversationId}`);
    await sendText(an.page, 'Chào cả nhóm');
    await expect(binh.page.getByRole('region', { name: 'Nội dung cuộc trò chuyện' }).getByText('Chào cả nhóm', { exact: true })).toBeVisible({ timeout: 15_000 });

    // Image attachment.
    await an.page.locator('input[type="file"][accept*="image"]').setInputFiles('e2e/profile-live/fixtures/avatar.png');
    await an.page.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(binh.page.locator('img[alt="Ảnh đính kèm"]').first()).toBeVisible({ timeout: 15_000 });

    // File attachment.
    await an.page.locator('input[type="file"][accept*="pdf"]').setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('nội dung tệp E2E'),
    });
    await an.page.getByRole('button', { name: 'Gửi', exact: true }).click();
    await expect(binh.page.getByText('note.txt', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    await an.context.close();
    await binh.context.close();
  });

  test('blocking is two-way and unblock restores sending', async ({ browser }) => {
    test.setTimeout(180_000);
    const an = await newPlayer(browser, 'demo_block_an@example.com', 'An Chặn');
    const binh = await newPlayer(browser, 'demo_block_binh@example.com', 'Bình Bị Chặn');
    const conversationId = await directConversation(an.context, binh.account);
    await an.page.goto(`/messages/${conversationId}`);
    await binh.page.goto(`/messages/${conversationId}`);
    await sendText(an.page, 'Tin trước khi chặn');
    await expect(binh.page.getByRole('region', { name: 'Nội dung cuộc trò chuyện' }).getByText('Tin trước khi chặn', { exact: true })).toBeVisible();

    // A blocks B from the direct-chat header.
    await an.page.getByRole('button', { name: 'Chặn', exact: true }).click();
    await expect(an.page.getByText('Đã chặn người chơi này. Lịch sử trò chuyện vẫn được giữ lại.')).toBeVisible();

    // B can no longer send: the real API rejects it and the composer is disabled after reload.
    const blockedSend = await apiRaw(binh.context, 'POST', `/conversations/${conversationId}/messages`, {
      text: 'Tin khi bị chặn',
      clientMessageId: crypto.randomUUID(),
    });
    expect(blockedSend.status()).toBeGreaterThanOrEqual(400);
    await binh.page.reload();
    await expect(
      binh.page.getByText('Không thể gửi tin nhắn mới cho cuộc trò chuyện này. Lịch sử tin nhắn vẫn được giữ nguyên.')
    ).toBeVisible();

    // A unblocks from the block list; B can send again.
    await an.page.goto('/settings/blocks');
    await expect(an.page.getByRole('heading', { name: 'Danh sách người chơi đã chặn', exact: true })).toBeVisible();
    await an.page.getByRole('button', { name: 'Bỏ chặn', exact: true }).first().click();
    await an.page.goto(`/messages/${conversationId}`);
    await binh.page.reload();
    await expect(binh.page.getByRole('textbox', { name: 'Nội dung tin nhắn' })).toBeEnabled();
    await sendText(binh.page, 'Đã gửi lại được');
    await expect(an.page.getByRole('region', { name: 'Nội dung cuộc trò chuyện' }).getByText('Đã gửi lại được', { exact: true })).toBeVisible({ timeout: 15_000 });

    await an.context.close();
    await binh.context.close();
  });
});
