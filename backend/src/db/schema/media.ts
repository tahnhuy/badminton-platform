import { sql } from 'drizzle-orm';
import { pgTable, bigint, varchar, integer, char, timestamp, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

// database-schema.md §13.1 — private uploaded images/files shared by Social and Messaging.
// Rows are never deleted in MVP; file lifecycle is §13.9 (SOC-02).
export const mediaFiles = pgTable('media_files', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  ownerId: bigint('owner_id', { mode: 'number' }).notNull().references(() => users.id),
  kind: varchar('kind').notNull(),
  mimeType: varchar('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  sha256: char('sha256', { length: 64 }).notNull(),
  storageKey: varchar('storage_key').notNull(),
  originalName: varchar('original_name', { length: 255 }),
  state: varchar('state').notNull().default('READY'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  kind: check('chk_media_files_kind', sql`${t.kind} IN ('IMAGE', 'FILE')`),
  byteSize: check('chk_media_files_byte_size', sql`${t.byteSize} > 0`),
  state: check('chk_media_files_state', sql`${t.state} IN ('READY', 'MISSING')`),
  storageKey: uniqueIndex('uq_media_files_storage_key').on(t.storageKey),
}));
