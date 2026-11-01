import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  db,
  mediaFiles,
  conversations,
  conversationMembers,
  messages,
  messageAttachments,
  messageReactions,
  userBlocks,
  userPresence,
  conversationTyping,
} from '../db';
import { createTestUser } from './test-helpers';
import { parseMessagingConfig, messagingConfig } from '../shared/config/messaging-config';

describe('Messaging schema & config foundation (MSG-01, SC-12)', () => {
  it('enforces direct conversation low < high pair and unique pair constraint', async () => {
    const u1 = await createTestUser({ role: 'PLAYER' });
    const u2 = await createTestUser({ role: 'PLAYER' });
    const lowId = Math.min(u1.id, u2.id);
    const highId = Math.max(u1.id, u2.id);

    // Inverted order (high, low) rejected by CHECK constraint
    await expect(
      db.insert(conversations).values({
        type: 'DIRECT',
        directUserLowId: highId,
        directUserHighId: lowId,
      })
    ).rejects.toThrow();

    // Direct conversation with title rejected by CHECK constraint
    await expect(
      db.insert(conversations).values({
        type: 'DIRECT',
        title: 'Should fail',
        directUserLowId: lowId,
        directUserHighId: highId,
      })
    ).rejects.toThrow();

    // Valid direct conversation succeeds
    const [direct] = await db
      .insert(conversations)
      .values({
        type: 'DIRECT',
        directUserLowId: lowId,
        directUserHighId: highId,
      })
      .returning();
    expect(direct.id).toBeGreaterThan(0);

    // Duplicate direct conversation for same pair rejected by partial unique index
    await expect(
      db.insert(conversations).values({
        type: 'DIRECT',
        directUserLowId: lowId,
        directUserHighId: highId,
      })
    ).rejects.toThrow();
  });

  it('enforces group conversation title CHECK and forbids direct user columns on GROUP', async () => {
    const creator = await createTestUser({ role: 'PLAYER' });

    // Blank title rejected
    await expect(
      db.insert(conversations).values({
        type: 'GROUP',
        title: '   ',
        createdBy: creator.id,
      })
    ).rejects.toThrow();

    // Missing title on GROUP rejected
    await expect(
      db.insert(conversations).values({
        type: 'GROUP',
        createdBy: creator.id,
      })
    ).rejects.toThrow();

    // Valid group conversation succeeds
    const [group] = await db
      .insert(conversations)
      .values({
        type: 'GROUP',
        title: 'Hội Cầu Lông Tối Thứ 5',
        createdBy: creator.id,
      })
      .returning();
    expect(group.title).toBe('Hội Cầu Lông Tối Thứ 5');
  });

  it('enforces message sequence uniqueness, clientMessageId idempotency index, and attachment/reaction constraints', async () => {
    const sender = await createTestUser({ role: 'PLAYER' });
    const [group] = await db
      .insert(conversations)
      .values({
        type: 'GROUP',
        title: 'Test Group',
        createdBy: sender.id,
      })
      .returning();

    await db.insert(conversationMembers).values({
      conversationId: group.id,
      userId: sender.id,
      state: 'ACTIVE',
    });

    const clientMessageId = randomUUID();
    const contentHash = 'a'.repeat(64);

    const [msg1] = await db
      .insert(messages)
      .values({
        conversationId: group.id,
        seq: 1,
        senderId: sender.id,
        body: 'Xin chào nhóm!',
        clientMessageId,
        contentHash,
      })
      .returning();
    expect(msg1.seq).toBe(1);

    // Duplicate (conversation_id, seq) rejected
    await expect(
      db.insert(messages).values({
        conversationId: group.id,
        seq: 1,
        senderId: sender.id,
        body: 'Khác nội dung',
        clientMessageId: randomUUID(),
        contentHash,
      })
    ).rejects.toThrow();

    // Duplicate (sender_id, conversation_id, client_message_id) rejected
    await expect(
      db.insert(messages).values({
        conversationId: group.id,
        seq: 2,
        senderId: sender.id,
        body: 'Trùng clientMessageId',
        clientMessageId,
        contentHash,
      })
    ).rejects.toThrow();

    // Media file and attachment position CHECK (1..4)
    const [media] = await db
      .insert(mediaFiles)
      .values({
        ownerId: sender.id,
        kind: 'IMAGE',
        mimeType: 'image/jpeg',
        byteSize: 1024,
        sha256: 'b'.repeat(64),
        storageKey: `test/${randomUUID()}.jpg`,
      })
      .returning();

    await expect(
      db.insert(messageAttachments).values({
        messageId: msg1.id,
        mediaId: media.id,
        position: 5,
      })
    ).rejects.toThrow();

    await db.insert(messageAttachments).values({
      messageId: msg1.id,
      mediaId: media.id,
      position: 1,
    });

    // Reaction type CHECK
    await expect(
      db.insert(messageReactions).values({
        messageId: msg1.id,
        userId: sender.id,
        type: 'INVALID_REACTION',
      })
    ).rejects.toThrow();

    await db.insert(messageReactions).values({
      messageId: msg1.id,
      userId: sender.id,
      type: 'LOVE',
    });
  });

  it('rejects self-blocking and supports presence and typing tables', async () => {
    const u1 = await createTestUser({ role: 'PLAYER' });
    const u2 = await createTestUser({ role: 'PLAYER' });

    await expect(
      db.insert(userBlocks).values({
        blockerId: u1.id,
        blockedId: u1.id,
      })
    ).rejects.toThrow();

    await db.insert(userBlocks).values({
      blockerId: u1.id,
      blockedId: u2.id,
    });

    await db.insert(userPresence).values({
      userId: u1.id,
      lastSeenAt: new Date(),
    });

    const [group] = await db
      .insert(conversations)
      .values({
        type: 'GROUP',
        title: 'Typing Group',
        createdBy: u1.id,
      })
      .returning();

    await db.insert(conversationTyping).values({
      conversationId: group.id,
      userId: u1.id,
      expiresAt: new Date(Date.now() + 6000),
    });
  });

  it('loads seeded messaging config and falls back safely on invalid values', async () => {
    messagingConfig.clearCache();
    const cfg = await messagingConfig.get();
    expect(cfg).toEqual({
      enabled: true,
      groupMaxMembers: 50,
      newDirectConversationsPerDay: 20,
      messagesPerMinute: 30,
    });

    expect(
      parseMessagingConfig(
        new Map([
          ['MESSAGING_ENABLED', 'false'],
          ['MESSAGING_GROUP_MAX_MEMBERS', '25'],
          ['MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY', '10'],
          ['MESSAGING_MESSAGES_PER_MINUTE', '15'],
        ])
      )
    ).toEqual({
      enabled: false,
      groupMaxMembers: 25,
      newDirectConversationsPerDay: 10,
      messagesPerMinute: 15,
    });

    // Out-of-range values fall back to defaults
    expect(
      parseMessagingConfig(
        new Map([
          ['MESSAGING_GROUP_MAX_MEMBERS', '2'],
          ['MESSAGING_MESSAGES_PER_MINUTE', '0'],
        ])
      )
    ).toMatchObject({
      groupMaxMembers: 50,
      messagesPerMinute: 30,
    });
  });
});
