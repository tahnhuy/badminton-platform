import { sql } from 'drizzle-orm';
import {
  pgTable, bigint, varchar, text, smallint, char, uuid, timestamp, check, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { mediaFiles } from './media';
import { tournaments } from './tournaments';

// database-schema.md §13.2. `creation_hash` is immutable once written; the
// trigger is created in migration 0011 (trg_*_creation_hash_immutable).
export const posts = pgTable('posts', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  authorId: bigint('author_id', { mode: 'number' }).notNull().references(() => users.id),
  type: varchar('type').notNull(),
  title: varchar('title', { length: 120 }),
  body: text('body'),
  background: varchar('background', { length: 24 }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  hiddenBy: bigint('hidden_by', { mode: 'number' }).references(() => users.id),
  clientRequestId: uuid('client_request_id'),
  // Set only for TOURNAMENT_RESULT posts (Tournament Tech Design §4.3b).
  tournamentId: bigint('tournament_id', { mode: 'number' }).references(() => tournaments.id),
  // Required for new writes (service-enforced); NULL only for legacy backfill rows (MM-21).
  creationHash: char('creation_hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  type: check('chk_posts_type', sql`${t.type} IN ('FREE', 'MATCH_FINDING', 'TOURNAMENT_RESULT')`),
  tournament: check('chk_posts_tournament', sql`(${t.type} = 'TOURNAMENT_RESULT') = (${t.tournamentId} IS NOT NULL)`),
  tournamentResultOnce: uniqueIndex('uq_posts_author_tournament_result')
    .on(t.authorId, t.tournamentId)
    .where(sql`${t.type} = 'TOURNAMENT_RESULT' AND ${t.deletedAt} IS NULL`),
  background: check('chk_posts_background', sql`${t.background} IS NULL OR (${t.type} = 'FREE' AND ${t.background} IN ('forest', 'ocean', 'sunset', 'berry', 'midnight', 'confetti'))`),
  title: check('chk_posts_title', sql`${t.type} = 'MATCH_FINDING' OR ${t.title} IS NULL`),
  body: check('chk_posts_body_length', sql`char_length(${t.body}) <= 2000`),
  published: check('chk_posts_published', sql`${t.type} = 'MATCH_FINDING' OR ${t.publishedAt} IS NOT NULL`),
  hidden: check('chk_posts_hidden', sql`(${t.hiddenAt} IS NULL) = (${t.hiddenBy} IS NULL)`),
  clientRequest: uniqueIndex('uq_posts_author_client_request')
    .on(t.authorId, t.clientRequestId)
    .where(sql`${t.clientRequestId} IS NOT NULL`),
  feed: index('posts_feed_idx')
    .on(t.publishedAt.desc(), t.id.desc())
    .where(sql`${t.publishedAt} IS NOT NULL AND ${t.deletedAt} IS NULL AND ${t.hiddenAt} IS NULL`),
  quota: index('posts_author_type_created_idx').on(t.authorId, t.type, t.createdAt),
}));

export const postImages = pgTable('post_images', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  postId: bigint('post_id', { mode: 'number' }).notNull().references(() => posts.id),
  // Must reference a media row of kind IMAGE (cross-table rule, service-enforced in SOC-02/SOC-03).
  mediaId: bigint('media_id', { mode: 'number' }).notNull().references(() => mediaFiles.id),
  position: smallint('position').notNull(),
  detachedAt: timestamp('detached_at', { withTimezone: true }),
}, t => ({
  position: check('chk_post_images_position', sql`${t.position} BETWEEN 1 AND 4`),
  activePosition: uniqueIndex('uq_post_images_active_position')
    .on(t.postId, t.position)
    .where(sql`${t.detachedAt} IS NULL`),
}));

export const postReactions = pgTable('post_reactions', {
  postId: bigint('post_id', { mode: 'number' }).notNull().references(() => posts.id),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id),
  type: varchar('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  pk: primaryKey({ name: 'post_reactions_pkey', columns: [t.postId, t.userId] }),
  type: check('chk_post_reactions_type', sql`${t.type} IN ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY')`),
}));

export const postComments = pgTable('post_comments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  postId: bigint('post_id', { mode: 'number' }).notNull().references(() => posts.id),
  authorId: bigint('author_id', { mode: 'number' }).notNull().references(() => users.id),
  body: varchar('body', { length: 500 }).notNull(),
  clientRequestId: uuid('client_request_id'),
  creationHash: char('creation_hash', { length: 64 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: bigint('deleted_by', { mode: 'number' }).references(() => users.id),
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  hiddenBy: bigint('hidden_by', { mode: 'number' }).references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  body: check('chk_post_comments_body', sql`char_length(btrim(${t.body})) BETWEEN 1 AND 500`),
  byPost: index('post_comments_post_created_idx').on(t.postId, t.createdAt, t.id),
  byAuthor: index('post_comments_author_created_idx').on(t.authorId, t.createdAt),
  clientRequest: uniqueIndex('uq_post_comments_author_client_request')
    .on(t.authorId, t.clientRequestId)
    .where(sql`${t.clientRequestId} IS NOT NULL`),
}));
