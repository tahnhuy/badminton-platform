import { sql } from 'drizzle-orm';
import {
  pgTable,
  bigint,
  varchar,
  integer,
  smallint,
  boolean,
  char,
  text,
  uuid,
  timestamp,
  check,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const mediaFiles = pgTable(
  'media_files',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    ownerId: bigint('owner_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    kind: varchar('kind').notNull(),
    mimeType: varchar('mime_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: char('sha256', { length: 64 }).notNull(),
    storageKey: varchar('storage_key').notNull().unique(),
    originalName: varchar('original_name', { length: 255 }),
    state: varchar('state').notNull().default('READY'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    kindCheck: check('chk_media_files_kind', sql`${t.kind} IN ('IMAGE', 'FILE')`),
    byteSizeCheck: check('chk_media_files_byte_size', sql`${t.byteSize} > 0`),
    stateCheck: check('chk_media_files_state', sql`${t.state} IN ('READY', 'MISSING')`),
  })
);

export const conversations = pgTable(
  'conversations',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    type: varchar('type').notNull(),
    title: varchar('title', { length: 120 }),
    createdBy: bigint('created_by', { mode: 'number' }).references(() => users.id),
    isLocked: boolean('is_locked').notNull().default(false),
    status: varchar('status').notNull().default('ACTIVE'),
    dissolvedAt: timestamp('dissolved_at', { withTimezone: true }),
    directUserLowId: bigint('direct_user_low_id', { mode: 'number' }).references(() => users.id),
    directUserHighId: bigint('direct_user_high_id', { mode: 'number' }).references(() => users.id),
    lastSeq: bigint('last_seq', { mode: 'number' }).notNull().default(0),
    activityVersion: bigint('activity_version', { mode: 'number' }).notNull().default(0),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeCheck: check('chk_conversations_type', sql`${t.type} IN ('DIRECT', 'GROUP')`),
    statusCheck: check(
      'chk_conversations_status',
      sql`${t.status} IN ('ACTIVE', 'DISSOLVED')`
    ),
    titleCheck: check(
      'chk_conversations_title',
      sql`(${t.type} = 'GROUP' AND ${t.title} IS NOT NULL AND char_length(btrim(${t.title})) BETWEEN 1 AND 120) OR (${t.type} = 'DIRECT' AND ${t.title} IS NULL)`
    ),
    directColsCheck: check(
      'chk_conversations_direct_cols',
      sql`(${t.type} = 'DIRECT' AND ${t.directUserLowId} IS NOT NULL AND ${t.directUserHighId} IS NOT NULL AND ${t.directUserLowId} < ${t.directUserHighId}) OR (${t.type} = 'GROUP' AND ${t.directUserLowId} IS NULL AND ${t.directUserHighId} IS NULL)`
    ),
    directPairIdx: uniqueIndex('uq_conversations_direct_pair')
      .on(t.directUserLowId, t.directUserHighId)
      .where(sql`${t.type} = 'DIRECT'`),
    lastMessageIdx: index('conversations_last_message_idx').on(t.lastMessageAt, t.id),
  })
);

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: bigint('conversation_id', { mode: 'number' })
      .notNull()
      .references(() => conversations.id),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    state: varchar('state').notNull().default('ACTIVE'),
    lastReadSeq: bigint('last_read_seq', { mode: 'number' }).notNull().default(0),
    firstSentAt: timestamp('first_sent_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.conversationId, t.userId] }),
    stateCheck: check('chk_conversation_members_state', sql`${t.state} IN ('ACTIVE', 'LEFT')`),
    lastReadCheck: check('chk_conversation_members_last_read', sql`${t.lastReadSeq} >= 0`),
    userStateIdx: index('conversation_members_user_state_idx').on(t.userId, t.state),
  })
);

export const messages = pgTable(
  'messages',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    conversationId: bigint('conversation_id', { mode: 'number' })
      .notNull()
      .references(() => conversations.id),
    seq: bigint('seq', { mode: 'number' }).notNull(),
    senderId: bigint('sender_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    parentId: bigint('parent_id', { mode: 'number' }),
    body: text('body'),
    clientMessageId: uuid('client_message_id').notNull(),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    reactionVersion: bigint('reaction_version', { mode: 'number' }).notNull().default(0),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedByUserId: bigint('deleted_by_user_id', { mode: 'number' }).references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    seqCheck: check('chk_messages_seq_positive', sql`${t.seq} > 0`),
    bodyLengthCheck: check(
      'chk_messages_body_length',
      sql`${t.body} IS NULL OR char_length(${t.body}) <= 2000`
    ),
    deletedByCheck: check(
      'chk_messages_deleted_by',
      sql`(${t.deletedAt} IS NULL) = (${t.deletedByUserId} IS NULL)`
    ),
    conversationSeqIdx: uniqueIndex('uq_messages_conversation_seq').on(t.conversationId, t.seq),
    senderClientIdIdx: uniqueIndex('uq_messages_sender_conversation_client_id').on(
      t.senderId,
      t.conversationId,
      t.clientMessageId
    ),
    senderCreatedIdx: index('messages_sender_created_idx').on(t.senderId, t.createdAt),
  })
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    messageId: bigint('message_id', { mode: 'number' })
      .notNull()
      .references(() => messages.id),
    mediaId: bigint('media_id', { mode: 'number' })
      .notNull()
      .references(() => mediaFiles.id),
    position: smallint('position').notNull(),
  },
  (t) => ({
    positionCheck: check(
      'chk_message_attachments_position',
      sql`${t.position} BETWEEN 1 AND 4`
    ),
    messagePositionIdx: uniqueIndex('uq_message_attachments_position').on(t.messageId, t.position),
  })
);

export const messageReactions = pgTable(
  'message_reactions',
  {
    messageId: bigint('message_id', { mode: 'number' })
      .notNull()
      .references(() => messages.id),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    type: varchar('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.userId] }),
    typeCheck: check(
      'chk_message_reactions_type',
      sql`${t.type} IN ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY')`
    ),
  })
);

export const messageHides = pgTable(
  'message_hides',
  {
    messageId: bigint('message_id', { mode: 'number' })
      .notNull()
      .references(() => messages.id),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.userId] }),
    userIdx: index('message_hides_user_idx').on(t.userId),
  })
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: bigint('blocker_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    blockedId: bigint('blocked_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.blockerId, t.blockedId] }),
    noSelfBlockCheck: check('chk_user_blocks_no_self', sql`${t.blockerId} <> ${t.blockedId}`),
    blockedIdx: index('user_blocks_blocked_idx').on(t.blockedId),
  })
);

export const userPresence = pgTable('user_presence', {
  userId: bigint('user_id', { mode: 'number' })
    .primaryKey()
    .references(() => users.id),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversationTyping = pgTable(
  'conversation_typing',
  {
    conversationId: bigint('conversation_id', { mode: 'number' })
      .notNull()
      .references(() => conversations.id),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.conversationId, t.userId] }),
  })
);
