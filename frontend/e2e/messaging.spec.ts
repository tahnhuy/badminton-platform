import { test, expect } from '@playwright/test';

const meUser = {
  id: 2,
  email: 'player2@test.test',
  role: 'PLAYER',
  requiresPasswordChange: false,
};

const meProfile = {
  userId: 2,
  fullName: 'Bạn',
  avatarUrl: null,
  skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: null },
  ratings: null,
  stats: null,
};

const directConversation = {
  id: 101,
  type: 'DIRECT',
  title: null,
  createdBy: 2,
  isLocked: false,
  status: 'ACTIVE',
  lastSeq: 2,
  activityVersion: 2,
  lastMessageAt: '2026-11-01T08:05:00Z',
  createdAt: '2026-11-01T08:00:00Z',
  unreadCount: 1,
  canSend: true,
  sendDisabledReason: null,
  counterpart: {
    id: 3,
    fullName: 'Minh Cầu Lông',
    avatarUrl: null,
    skillLevel: { id: 2, code: 'INTERMEDIATE', name: 'Khá', rank: 3 },
    isActive: true,
    isOnline: true,
    lastSeenAt: '2026-11-01T08:05:00Z',
  },
  members: [
    {
      id: 2,
      fullName: 'Bạn',
      avatarUrl: null,
      skillLevel: null,
      isActive: true,
      state: 'ACTIVE',
      lastReadSeq: 1,
      joinedAt: '2026-11-01T08:00:00Z',
    },
    {
      id: 3,
      fullName: 'Minh Cầu Lông',
      avatarUrl: null,
      skillLevel: null,
      isActive: true,
      state: 'ACTIVE',
      lastReadSeq: 2,
      joinedAt: '2026-11-01T08:00:00Z',
    },
  ],
  lastMessage: {
    id: 501,
    seq: 2,
    senderId: 3,
    body: 'Tối nay đánh sân số 3 nhé!',
    deletedAt: null,
    createdAt: '2026-11-01T08:05:00Z',
  },
};

const groupConversation = {
  id: 202,
  type: 'GROUP',
  title: 'Hội Cầu Lông Quận 7',
  createdBy: 3,
  isLocked: false,
  status: 'ACTIVE',
  lastSeq: 1,
  activityVersion: 1,
  lastMessageAt: '2026-11-01T07:30:00Z',
  createdAt: '2026-11-01T07:00:00Z',
  unreadCount: 0,
  canSend: true,
  sendDisabledReason: null,
  counterpart: null,
  members: [
    {
      id: 2,
      fullName: 'Bạn',
      avatarUrl: null,
      skillLevel: null,
      isActive: true,
      state: 'ACTIVE',
      lastReadSeq: 1,
      joinedAt: '2026-11-01T07:00:00Z',
    },
    {
      id: 3,
      fullName: 'Minh Cầu Lông',
      avatarUrl: null,
      skillLevel: null,
      isActive: true,
      state: 'ACTIVE',
      lastReadSeq: 1,
      joinedAt: '2026-11-01T07:00:00Z',
    },
  ],
  lastMessage: {
    id: 601,
    seq: 1,
    senderId: 3,
    body: 'Chào cả nhóm!',
    deletedAt: null,
    createdAt: '2026-11-01T07:30:00Z',
  },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { data: meUser } })
  );
  await page.route('**/api/v1/players/me', (route) =>
    route.fulfill({ json: { data: meProfile } })
  );
  await page.route('**/api/v1/conversations/unread-summary', (route) =>
    route.fulfill({ json: { data: { totalUnread: 1 } } })
  );
  await page.route('**/api/v1/presence/heartbeat', (route) =>
    route.fulfill({
      json: {
        data: {
          lastSeenAt: '2026-11-01T08:05:00Z',
          isOnline: true,
          updated: true,
        },
      },
    })
  );
});

test('renders conversations, preserves clientMessageId on failed-send retry, and updates read marker after rendering', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  let sendAttempts = 0;
  let firstAttemptClientId: string | null = null;
  let secondAttemptClientId: string | null = null;
  let readPostedSeq: number | null = null;

  await page.route('**/api/v1/conversations?*', (route) =>
    route.fulfill({
      json: {
        data: [directConversation, groupConversation],
        meta: { page: 1, limit: 50, total: 2 },
      },
    })
  );

  await page.route('**/api/v1/conversations/101', (route) =>
    route.fulfill({ json: { data: directConversation } })
  );

  await page.route('**/api/v1/conversations/101/sync*', (route) =>
    route.fulfill({
      json: {
        data: {
          messages: [],
          nextAfterSeq: 2,
          hasMore: false,
          changedReactions: [],
          nextSinceVersion: 2,
          presence: [],
          typing: [],
        },
      },
    })
  );

  await page.route('**/api/v1/conversations/101/messages*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          data: [
            {
              id: 501,
              conversationId: 101,
              seq: 2,
              senderId: 3,
              senderName: 'Minh Cầu Lông',
              senderAvatarUrl: null,
              parentId: null,
              parentMessage: null,
              body: 'Tối nay đánh sân số 3 nhé!',
              clientMessageId: '11111111-1111-4111-8111-111111111111',
              reactionVersion: 0,
              editedAt: null,
              deletedAt: null,
              deletedByUserId: null,
              attachments: [],
              reactions: [],
              createdAt: '2026-11-01T08:05:00Z',
            },
          ],
          meta: { limit: 30, nextBeforeSeq: null },
        },
      });
    }

    sendAttempts += 1;
    const body = route.request().postDataJSON() as {
      clientMessageId: string;
      text: string;
    };
    if (sendAttempts === 1) {
      firstAttemptClientId = body.clientMessageId;
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Mất kết nối tạm thời',
          },
        },
      });
    }

    secondAttemptClientId = body.clientMessageId;
    return route.fulfill({
      status: 201,
      json: {
        data: {
          id: 502,
          conversationId: 101,
          seq: 3,
          senderId: 2,
          senderName: 'Bạn',
          senderAvatarUrl: null,
          parentId: null,
          parentMessage: null,
          body: body.text,
          clientMessageId: body.clientMessageId,
          reactionVersion: 0,
          editedAt: null,
          deletedAt: null,
          deletedByUserId: null,
          attachments: [],
          reactions: [],
          createdAt: '2026-11-01T08:06:00Z',
        },
      },
    });
  });

  await page.route('**/api/v1/conversations/101/read', (route) => {
    const body = route.request().postDataJSON() as { seq: number };
    readPostedSeq = body.seq;
    return route.fulfill({
      json: {
        data: {
          conversationId: 101,
          lastReadSeq: body.seq,
        },
      },
    });
  });

  await page.route('**/api/v1/conversations/101/typing', (route) =>
    route.fulfill({
      json: {
        data: {
          conversationId: 101,
          expiresAt: '2026-11-01T08:06:06Z',
          updated: true,
        },
      },
    })
  );

  await page.goto('/messages/101');
  await expect(page.getByText('Tối nay đánh sân số 3 nhé!').first()).toBeVisible();
  await expect.poll(() => readPostedSeq).toBe(2);

  // Send a message that fails on first attempt, then click retry ("Thử lại")
  const composer = page.getByPlaceholder(/Nhập tin nhắn/i);
  await composer.fill('Ok chốt 19h nhé!');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại' }).click();

  await expect.poll(() => sendAttempts).toBe(2);
  expect(firstAttemptClientId).toBeTruthy();
  expect(secondAttemptClientId).toBe(firstAttemptClientId);
  await expect(page.getByRole('button', { name: 'Thử lại' })).toHaveCount(0);
});

test('opens the global floating chat dock on non-messages pages and hides it on /messages', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.route('**/api/v1/conversations?*', (route) =>
    route.fulfill({
      json: {
        data: [directConversation, groupConversation],
        meta: { page: 1, limit: 30, total: 2 },
      },
    })
  );

  await page.goto('/');
  const bubble = page.getByRole('button', { name: 'Mở khung tin nhắn nhanh' });
  await expect(bubble).toBeVisible();

  await bubble.click();
  await expect(page.getByRole('complementary', { name: 'Khung tin nhắn nhanh' })).toBeVisible();
  await expect(page.getByText('Minh Cầu Lông')).toBeVisible();

  // Navigate to /messages -> floating bubble/dock automatically hides
  await page.goto('/messages');
  await expect(bubble).toHaveCount(0);
});

test('manages blocked players on /settings/blocks', async ({ page }) => {
  let unblocked = false;

  await page.route('**/api/v1/blocks', (route) =>
    route.fulfill({
      json: {
        data: unblocked
          ? []
          : [
              {
                playerId: 9,
                fullName: 'Người Chơi Bị Chặn',
                avatarUrl: null,
                blockedAt: '2026-11-01T06:00:00Z',
              },
            ],
      },
    })
  );

  await page.route('**/api/v1/blocks/9', (route) => {
    unblocked = true;
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/settings/blocks');
  await expect(page.getByText('Người Chơi Bị Chặn')).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ chặn' }).click();
  await expect.poll(() => unblocked).toBe(true);
});
