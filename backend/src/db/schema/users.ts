import { sql } from 'drizzle-orm';
import { pgTable, bigint, varchar, text, timestamp, integer, boolean, index, numeric, check } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  email: varchar('email').notNull().unique(),
  passwordHash: varchar('password_hash').notNull(),
  role: varchar('role').notNull(), // PLAYER | COURT_OWNER | ADMIN
  status: varchar('status').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  idxUsersRoleStatusId: index('users_role_status_id_idx').on(t.role, t.status, t.id),
  idxUsersEmail: index('users_email_idx').on(t.email),
  idxUsersRoleStatusCreated: index('users_role_status_created_idx').on(t.role, t.status, t.createdAt),
}));

export const skillLevels = pgTable('skill_levels', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  code: varchar('code').notNull().unique(),
  name: varchar('name').notNull(),
  rank: integer('rank').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const playerProfiles = pgTable('player_profiles', {
  userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id),
  fullName: varchar('full_name').notNull(),
  skillLevelId: bigint('skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  avatarUrl: varchar('avatar_url'),
  phone: varchar('phone', { length: 20 }),
  /** True until an official promotion through professional tournaments (§13.8). */
  isSkillTentative: boolean('is_skill_tentative').notNull().default(true),
  // Cache of the skill rating R in [0, 100] (Tournament Tech Design §7.10, TRN-14); NULL until
  // the first replay — the initial value is derived from the survey score.
  skillRating: numeric('skill_rating', { precision: 6, scale: 2 }),
  ratedMatchCount: integer('rated_match_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkSkillRating: check('chk_player_profiles_skill_rating', sql`${t.skillRating} IS NULL OR ${t.skillRating} BETWEEN 0 AND 100`),
}));

export const courtOwnerProfiles = pgTable('court_owner_profiles', {
  userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id),
  businessName: varchar('business_name').notNull(),
  phone: varchar('phone').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
