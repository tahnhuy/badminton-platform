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
  lastSeq: 2,
  activityVersion: 2,
  readOnlyAt: null,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:05:00Z',
  unreadCount: 1,
  myMember: {
    state: 'ACTIVE',
    lastReadSeq: 1,
    joinedAt: '2026-11-01T08:00:00Z',
    leftAt: null,
  },
  counterpart: {
    userId: 3,
    displayName: 'Minh Cầu Lông',
    avatarUrl: null,
    status: 'ACTIVE',
    isOnline: true,
    lastSeenAt: '2026-11-01T08:05:00Z',
  },
  isBlockedEitherWay: false,
  isBlockedByMe: false,
  activeMemberCount: 2,
  members: [
    {
      userId: 2,
      displayName: 'Bạn',
      avatarUrl: null,
      state: 'ACTIVE',
      userStatus: 'ACTIVE',
      lastReadSeq: 1,
      isOnline: true,
      lastSeenAt: '2026-11-01T08:05:00Z',
    },
    {
      userId: 3,
      displayName: 'Minh Cầu Lông',
      avatarUrl: null,
      state: 'ACTIVE',
      userStatus: 'ACTIVE',
      lastReadSeq: 2,
      isOnline: true,
      lastSeenAt: '2026-11-01T08:05:00Z',
    },
  ],
  lastMessage: {
    id: 501,
    seq: 2,
    senderId: 3,
    senderName: 'Minh Cầu Lông',
    text: 'Tối nay đánh sân số 3 nhé!',
    hasImages: false,
    hasFile: false,
    createdAt: '2026-11-01T08:05:00Z',
  },
};

const groupConversation = {
  id: 202,
  type: 'GROUP',
  title: 'Hội Cầu Lông Quận 7',
  lastSeq: 1,
  activityVersion: 1,
  readOnlyAt: null,
  createdAt: '2026-11-01T07:00:00Z',
  updatedAt: '2026-11-01T07:30:00Z',
  unreadCount: 0,
  myMember: {
    state: 'ACTIVE',
    lastReadSeq: 1,
    joinedAt: '2026-11-01T07:00:00Z',
    leftAt: null,
  },
  counterpart: null,
  isBlockedEitherWay: false,
  isBlockedByMe: false,
  activeMemberCount: 4,
  members: [
    {
      userId: 2,
      displayName: 'Bạn',
      avatarUrl: null,
      state: 'ACTIVE',
      userStatus: 'ACTIVE',
      lastReadSeq: 1,
      isOnline: true,
      lastSeenAt: null,
    },
    {
      userId: 3,
      displayName: 'Minh Cầu Lông',
      avatarUrl: null,
      state: 'ACTIVE',
      userStatus: 'ACTIVE',
      lastReadSeq: 1,
      isOnline: true,
      lastSeenAt: null,
    },
    {
      userId: 4,
      displayName: 'Lan Nguyễn',
      avatarUrl: null,
      state: 'ACTIVE',
      userStatus: 'ACTIVE',
      lastReadSeq: 1,
      isOnline: false,
      lastSeenAt: null,
    },
    {
      userId: 5,
      displayName: 'Hoàng Trần',
      avatarUrl: null,
      state: 'ACTIVE',
      userStatus: 'ACTIVE',
      lastReadSeq: 1,
      isOnline: false,
      lastSeenAt: null,
    },
    {
      userId: 6,
      displayName: 'Người Đã Rời',
      avatarUrl: null,
      state: 'LEFT',
      userStatus: 'ACTIVE',
      lastReadSeq: 1,
      isOnline: false,
      lastSeenAt: null,
    },
  ],
  lastMessage: {
    id: 601,
    seq: 1,
    senderId: 2,
    senderName: 'Bạn',
    text: 'Chào cả nhóm!',
    hasImages: false,
    hasFile: false,
    createdAt: '2026-11-01T07:30:00Z',
  },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { data: meUser } }),
  );
  await page.route('**/api/v1/players/me', (route) =>
    route.fulfill({ json: { data: meProfile } }),
  );
  await page.route('**/api/v1/presence/heartbeat', (route) =>
    route.fulfill({
      json: {
        data: {
          userId: 2,
          lastSeenAt: '2026-11-01T08:05:00Z',
          onlineUntilAt: '2026-11-01T08:06:00Z',
          written: true,
        },
      },
    }),
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

  await page.route('**/api/v1/conversations', (route) =>
    route.fulfill({
      json: {
        data: {
          conversations: [directConversation, groupConversation],
          totalUnreadCount: 1,
        },
      },
    }),
  );

  await page.route('**/api/v1/conversations/101', (route) =>
    route.fulfill({ json: { data: directConversation } }),
  );

  await page.route('**/api/v1/conversations/101/messages*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          data: {
            messages: [
              {
                id: 500,
                conversationId: 101,
                seq: 1,
                senderId: 2,
                senderName: 'Bạn',
                senderAvatarUrl: null,
                senderStatus: 'ACTIVE',
                text: 'Chào Minh!',
                attachments: [],
                reactions: [],
                reactionVersion: 0,
                createdAt: '2026-11-01T08:01:00Z',
              },
              {
                id: 501,
                conversationId: 101,
                seq: 2,
                senderId: 3,
                senderName: 'Minh Cầu Lông',
                senderAvatarUrl: null,
                senderStatus: 'ACTIVE',
                text: 'Tối nay đánh sân số 3 nhé!',
                attachments: [],
                reactions: [],
                reactionVersion: 0,
                createdAt: '2026-11-01T08:05:00Z',
              },
            ],
            nextBeforeSeq: null,
            hasMore: false,
            lastSeq: 2,
            activityVersion: 2,
          },
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
          senderStatus: 'ACTIVE',
          clientMessageId: body.clientMessageId,
          text: body.text,
          attachments: [],
          reactions: [],
          reactionVersion: 0,
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
          unreadCount: 0,
          totalUnreadCount: 0,
        },
      },
    });
  });

  await page.route('**/api/v1/conversations/101/typing', (route) =>
    route.fulfill({
      json: {
        data: {
          conversationId: 101,
          userId: 2,
          isTyping: true,
          expiresAt: '2026-11-01T08:06:06Z',
          written: true,
        },
      },
    }),
  );

  await page.goto('/messages/101');
  await expect(page.getByText('Tối nay đánh sân số 3 nhé!')).toBeVisible();
  await expect.poll(() => readPostedSeq).toBe(2);

  // Send a message that fails on first attempt, then click retry ("Gửi lại")
  const composer = page.getByPlaceholder('Nhập tin nhắn...');
  await composer.fill('Ok chốt 19h nhé!');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi lại' }).click();

  await expect.poll(() => sendAttempts).toBe(2);
  expect(firstAttemptClientId).toBeTruthy();
  expect(secondAttemptClientId).toBe(firstAttemptClientId);
  await expect(page.getByRole('button', { name: 'Gửi lại' })).toHaveCount(0);
});

test('displays active group member count excluding LEFT members and handles leaving a group', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  let left = false;

  await page.route('**/api/v1/conversations', (route) =>
    route.fulfill({
      json: {
        data: {
          conversations: left ? [directConversation] : [directConversation, groupConversation],
          totalUnreadCount: 0,
        },
      },
    }),
  );

  await page.route('**/api/v1/conversations/202', (route) =>
    route.fulfill({ json: { data: groupConversation } }),
  );

  await page.route('**/api/v1/conversations/202/messages*', (route) =>
    route.fulfill({
      json: {
        data: {
          messages: [
            {
              id: 601,
              conversationId: 202,
              seq: 1,
              senderId: 2,
              senderName: 'Bạn',
              senderAvatarUrl: null,
              senderStatus: 'ACTIVE',
              text: 'Chào cả nhóm!',
              attachments: [],
              reactions: [],
              reactionVersion: 0,
              createdAt: '2026-11-01T07:30:00Z',
            },
          ],
          nextBeforeSeq: null,
          hasMore: false,
          lastSeq: 1,
          activityVersion: 1,
        },
      },
    }),
  );

  await page.route('**/api/v1/conversations/202/members/me/leave', (route) => {
    left = true;
    return route.fulfill({
      json: {
        data: {
          conversationId: 202,
          userId: 2,
          state: 'LEFT',
          leftAt: '2026-11-01T08:10:00Z',
        },
      },
    });
  });

  await page.goto('/messages/202');
  // 4 ACTIVE members and 1 LEFT member -> header shows "Nhóm · 4 thành viên"
  await expect(page.getByText('Nhóm · 4 thành viên')).toBeVisible();

  await page.getByRole('button', { name: 'Thành viên (4)' }).click();
  await expect(page.getByRole('dialog')).toContainText('Thành viên nhóm (4 đang tham gia)');
  await page.getByRole('button', { name: 'Rời khỏi nhóm trò chuyện' }).click();
  await page.getByRole('button', { name: 'Xác nhận rời nhóm' }).click();

  await expect.poll(() => left).toBe(true);
  await expect(page).toHaveURL(/\/messages$/);
});

test('manages blocked players on /settings/blocks', async ({ page }) => {
  let unblocked = false;

  await page.route('**/api/v1/blocks', (route) =>
    route.fulfill({
      json: {
        data: {
          blocks: unblocked
            ? []
            : [
                {
                  userId: 9,
                  displayName: 'Người Chơi Bị Chặn',
                  avatarUrl: null,
                  userStatus: 'ACTIVE',
                  blockedAt: '2026-11-01T06:00:00Z',
                },
              ],
        },
      },
    }),
  );

  await page.route('**/api/v1/blocks/9', (route) => {
    unblocked = true;
    return route.fulfill({
      json: { data: { blockedUserId: 9, blocked: false } },
    });
  });

  await page.goto('/settings/blocks');
  await expect(page.getByText('Người Chơi Bị Chặn')).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ chặn' }).click();
  await expect.poll(() => unblocked).toBe(true);
  await expect(page.getByText('Bạn chưa chặn người chơi nào')).toBeVisible();
});
