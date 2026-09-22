import { pgTable, bigint, varchar, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  email: varchar('email').notNull().unique(),
  passwordHash: varchar('password_hash').notNull(),
  role: varchar('role').notNull(), // PLAYER | COURT_OWNER | ADMIN
  status: varchar('status').notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  idxUsersRoleStatusId: index('users_role_status_id_idx').on(t.role, t.status, t.id),
  idxUsersEmail: index('users_email_idx').on(t.email),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const courtOwnerProfiles = pgTable('court_owner_profiles', {
  userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id),
  businessName: varchar('business_name').notNull(),
  phone: varchar('phone').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
