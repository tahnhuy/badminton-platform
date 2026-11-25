import { randomUUID } from 'node:crypto';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  apiRaw,
  apiRequest,
  createE2EUser,
  loginViaUi,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  runJobs,
  seedCourt,
  topUpWallet,
  vnDate,
} from '../e2e-helpers';

async function newAdmin(browser: Browser, email: string): Promise<{ page: Page; context: BrowserContext }> {
  const admin = await createE2EUser({ email, role: 'ADMIN' });
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginViaUi(page, admin.email, admin.plainPassword);
  return { page, context };
}

test.describe('Demo: admin operations', () => {
  test.beforeEach(async () => {
    await resetDatabase();
    await resetSystemConfigs();
  });

  test('dashboard KPIs and quick navigation', async ({ browser }) => {
    const { page, context } = await newAdmin(browser, 'demo_admin_dash@example.com');
    await seedCourt();
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Bảng điều khiển', exact: true })).toBeVisible();
    await expect(page.getByTestId('kpi-card')).toHaveCount(6);
    await expect(page.getByTestId('recent-activity')).toBeVisible();
    await expect(page.getByTestId('growth-chart')).toBeVisible();
    await page.getByTestId('quick-link').filter({ hasText: 'Báo cáo' }).click();
    await expect(page).toHaveURL(/\/admin\/reports/);
    await context.close();
  });

  test('user management suspends and reactivates a player', async ({ browser }) => {
    const { page, context } = await newAdmin(browser, 'demo_admin_users@example.com');
    const player = await createE2EUser({ email: 'demo_suspend_me@example.com', role: 'PLAYER' });

    await page.goto('/admin/users');
    await page.getByPlaceholder('Tìm theo họ tên, email, SĐT, mã định danh...').fill(player.email);
    const row = page.getByRole('row').filter({ hasText: player.email });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: `Thao tác với ${player.email}` }).click();
    await page.getByRole('menuitem', { name: 'Đổi trạng thái' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Thay đổi trạng thái tài khoản' })).toBeVisible();
    await dialog.getByRole('radio', { name: 'SUSPENDED (Tạm đình chỉ)' }).check();
    await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText(/Đã cập nhật trạng thái người dùng thành SUSPENDED/)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: player.email })).toContainText('Đình chỉ (Vi phạm)');

    // Reactivate.
    await page.getByRole('row').filter({ hasText: player.email }).getByRole('button', { name: `Thao tác với ${player.email}` }).click();
    await page.getByRole('menuitem', { name: 'Đổi trạng thái' }).click();
    await page.getByRole('dialog').getByRole('radio', { name: 'ACTIVE (Hoạt động)' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText(/Đã cập nhật trạng thái người dùng thành ACTIVE/)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: player.email })).toContainText('Hoạt động');

    await context.close();
  });

  test('a real report is reviewed and the post is hidden', async ({ browser }) => {
    const authorContext = await browser.newContext();
    const reporterContext = await browser.newContext();
    await registerAccount(authorContext, { email: 'demo_report_author@example.com', fullName: 'Tác Giả Demo' });
    await registerAccount(reporterContext, { email: 'demo_reporter@example.com', fullName: 'Người Báo Cáo' });

    const body = 'Nội dung cần kiểm duyệt E2E';
    const created = await apiRequest<{ data: { id: number } }>(authorContext, 'POST', '/posts', {
      type: 'FREE',
      body,
      clientRequestId: randomUUID(),
    });
    const postId = created.data.id;

    const report = await apiRequest<{ data: { id: number } }>(reporterContext, 'POST', '/reports', {
      targetType: 'POST',
      targetId: postId,
      reasonCode: 'SPAM',
      description: 'Spam quảng cáo',
    });

    const { page, context } = await newAdmin(browser, 'demo_admin_reports@example.com');
    await page.goto('/admin/reports');
    await page.getByRole('button', { name: 'Xem & xử lý', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Bằng chứng tại thời điểm gửi')).toBeVisible();
    await expect(dialog.getByText(body).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Ẩn bài viết', exact: true }).click();
    await expect(page.getByText(new RegExp(`Đã ẩn bài viết #${postId}`))).toBeVisible();

    // Hidden posts disappear for everyone, including the author.
    const hidden = await apiRaw(authorContext, 'GET', `/posts/${postId}`);
    expect(hidden.status()).toBe(404);

    // Resolve the report through the real admin API, then verify the status.
    await apiRequest(context, 'PATCH', `/admin/reports/${report.data.id}/status`, { status: 'RESOLVED' });
    const reports = await apiRequest<{ data: Array<{ id: number; status: string }> }>(context, 'GET', '/admin/reports?limit=50');
    expect(reports.data.find((row) => row.id === report.data.id)?.status).toBe('RESOLVED');

    await authorContext.close();
    await reporterContext.close();
    await context.close();
  });

  test('a real report is reviewed and the comment is hidden', async ({ browser }) => {
    const authorContext = await browser.newContext();
    const commenterContext = await browser.newContext();
    await registerAccount(authorContext, { email: 'demo_comment_author@example.com', fullName: 'Chủ Bài' });
    await registerAccount(commenterContext, { email: 'demo_commenter@example.com', fullName: 'Bình Luận Viên' });

    const post = await apiRequest<{ data: { id: number } }>(authorContext, 'POST', '/posts', {
      type: 'FREE',
      body: 'Bài viết có bình luận bị báo cáo',
      clientRequestId: randomUUID(),
    });
    const commentBody = 'Bình luận xúc phạm E2E';
    const comment = await apiRequest<{ data: { id: number } }>(commenterContext, 'POST', `/posts/${post.data.id}/comments`, {
      body: commentBody,
      clientRequestId: randomUUID(),
    });
    await apiRequest(authorContext, 'POST', '/reports', {
      targetType: 'COMMENT',
      targetId: comment.data.id,
      reasonCode: 'HARASSMENT',
    });

    const { page, context } = await newAdmin(browser, 'demo_admin_comment_reports@example.com');
    await page.goto('/admin/reports');
    await page.getByRole('button', { name: 'Xem & xử lý', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(commentBody).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Ẩn bình luận', exact: true }).click();
    await expect(page.getByText(new RegExp(`Đã ẩn bình luận #${comment.data.id}`))).toBeVisible();

    const comments = await apiRequest<{ data: Array<{ id: number }> }>(authorContext, 'GET', `/posts/${post.data.id}/comments`);
    expect(comments.data.find((row) => row.id === comment.data.id)).toBeUndefined();

    await authorContext.close();
    await commenterContext.close();
    await context.close();
  });

  test('system config change takes effect and is restored', async ({ browser }) => {
    const { page, context } = await newAdmin(browser, 'demo_admin_config@example.com');
    const playerContext = await browser.newContext();
    await registerAccount(playerContext, { email: 'demo_config_player@example.com' });

    try {
      await page.goto('/admin/configs');
      await page.getByPlaceholder('Tìm theo chức năng hoặc mô tả...').fill('Bật bảng tin cộng đồng');
      const card = page.getByRole('article').filter({ hasText: 'Bật bảng tin cộng đồng' }).first();
      await expect(card).toBeVisible();
      await card.getByRole('radio', { name: 'Tắt bảng tin' }).check();
      await card.getByRole('button', { name: 'Lưu', exact: true }).click();
      await expect(page.getByText(/Đã lưu "Bật bảng tin cộng đồng"/)).toBeVisible();

      // Effect: posting is now rejected by the real API.
      const blocked = await apiRaw(playerContext, 'POST', '/posts', {
        type: 'FREE',
        body: 'Không được đăng khi bảng tin tắt',
        clientRequestId: randomUUID(),
      });
      expect(blocked.status()).toBe(409);
      expect((await blocked.json()).error.code).toBe('SOCIAL_DISABLED');
    } finally {
      // Restore through the real admin API so other specs are unaffected (system_configs is
      // intentionally not truncated by /test/reset).
      await apiRequest(context, 'PATCH', '/admin/configs/SOCIAL_FEED_ENABLED', { value: true });
      await resetSystemConfigs();
    }

    const allowed = await apiRaw(playerContext, 'POST', '/posts', {
      type: 'FREE',
      body: 'Đăng được sau khi bật lại',
      clientRequestId: randomUUID(),
    });
    expect(allowed.status()).toBe(201);

    await playerContext.close();
    await context.close();
  });

  test('finance console: payout approval, refunds and reconciliation', async ({ browser }) => {
    test.setTimeout(180_000);
    const playerContext = await browser.newContext();
    await registerAccount(playerContext, { email: 'demo_finance_player@example.com', fullName: 'Ví Demo' });
    await topUpWallet(playerContext, 500_000);
    const court = await seedCourt();

    const created = await apiRequest<{ data: { id: number } }>(playerContext, 'POST', '/bookings', {
      courtId: court.courtId,
      bookingDate: vnDate(1),
      startTime: '06:00',
      durationMinutes: 60,
    });
    await apiRequest(playerContext, 'POST', `/bookings/${created.data.id}/payment`, { provider: 'WALLET' });
    await apiRequest(playerContext, 'POST', `/bookings/${created.data.id}/cancel`);
    await runJobs(playerContext);

    const { page, context } = await newAdmin(browser, 'demo_admin_finance@example.com');

    try {
      // Disable sandbox auto-approval so the admin actually reviews a PENDING payout.
      await apiRequest(context, 'PATCH', '/admin/configs/WALLET_AUTO_APPROVE_PAYOUTS', { value: false });

      const bank = await apiRequest<{ data: { id: number } }>(playerContext, 'POST', '/wallet/bank-accounts', {
        bankCode: 'VCB',
        accountNumber: '0123456789',
        accountName: 'VI DU DEMO',
        isDefault: true,
      });
      await apiRequest(playerContext, 'POST', '/wallet/withdrawals', {
        amount: '100000',
        bankAccountId: bank.data.id,
        withdrawalPin: '284691',
        clientRequestId: randomUUID(),
      });

      await page.goto('/admin/finance/overview');
      await expect(page.getByRole('heading', { name: 'Quản lý tài chính', exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Mục quản lý tài chính' }).getByRole('link')).toHaveCount(10);

      await page.getByRole('link', { name: 'Chi trả', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/finance\/payouts/);
      await expect(page.getByRole('button', { name: 'Duyệt', exact: true }).first()).toBeVisible();
      await page.getByRole('button', { name: 'Duyệt', exact: true }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Ghi chú duyệt (không bắt buộc)').fill('Duyệt E2E');
      await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0);

      await page.getByRole('link', { name: 'Hoàn tiền', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/finance\/refunds/);
      await expect(page.getByText('Không có yêu cầu hoàn tiền.', { exact: true })).toHaveCount(0);

      await page.getByRole('link', { name: 'Đối soát', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/finance\/reconciliation/);
      await page.getByRole('button', { name: 'Chạy đối soát', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Chạy đối soát', exact: true })).toBeVisible();
    } finally {
      await apiRequest(context, 'PATCH', '/admin/configs/WALLET_AUTO_APPROVE_PAYOUTS', { value: true });
      await resetSystemConfigs();
      await playerContext.close();
      await context.close();
    }
  });
});
