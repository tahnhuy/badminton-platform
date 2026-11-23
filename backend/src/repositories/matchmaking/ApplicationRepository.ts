import { and, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, matchmakingInvitations as rows, matchmakingRequests as requests, playerProfiles, skillLevels } from '../../db';
import type { ApplicationsQuery } from '../../validation/matchmaking';

const hostProfile = alias(playerProfiles, 'application_host');
const minSkill = alias(skillLevels, 'application_min_skill');
const maxSkill = alias(skillLevels, 'application_max_skill');
// Reads report effective status without waiting for the scheduler to persist closure.
const effectiveStatus = sql<string>`CASE WHEN ${rows.status} <> 'PENDING' THEN ${rows.status}
  WHEN ${requests.status} IN ('MATCHED', 'CANCELLED') THEN 'CANCELLED'
  WHEN ${rows.expiresAt} <= clock_timestamp() OR ${requests.startAt} <= clock_timestamp()
    OR ${requests.status} = 'EXPIRED' OR ${requests.expiresAt} <= clock_timestamp() THEN 'EXPIRED'
  ELSE 'PENDING' END`;

const selection = {
  id: rows.id, requestId: rows.requestId, playerId: rows.playerId,
  status: effectiveStatus, expiresAt: rows.expiresAt, respondedAt: rows.respondedAt,
  closeReason: rows.closeReason, createdAt: rows.createdAt,
  displayName: playerProfiles.fullName, skillLevelId: playerProfiles.skillLevelId,
  skillName: skillLevels.name, skillRank: skillLevels.rank, minRank: minSkill.rank, maxRank: maxSkill.rank,
  hostName: hostProfile.fullName,
  postId: requests.postId, hostId: requests.playerId, matchType: requests.matchType,
  startAt: requests.startAt, durationMinutes: requests.durationMinutes, requestStatus: requests.status,
};

function query() {
  return db.select(selection).from(rows).innerJoin(requests, eq(rows.requestId, requests.id))
    .leftJoin(hostProfile, eq(requests.playerId, hostProfile.userId))
    .leftJoin(playerProfiles, eq(rows.playerId, playerProfiles.userId))
    .leftJoin(skillLevels, eq(playerProfiles.skillLevelId, skillLevels.id))
    .innerJoin(minSkill, eq(requests.minSkillLevelId, minSkill.id))
    .innerJoin(maxSkill, eq(requests.maxSkillLevelId, maxSkill.id));
}
type ApplicationRow = Awaited<ReturnType<typeof query>>[number];
function dto(row: ApplicationRow) {
  return {
    id: row.id, requestId: row.requestId, playerId: row.playerId, status: row.status,
    expiresAt: row.expiresAt, respondedAt: row.respondedAt, closeReason: row.closeReason === 'BLOCKED' ? null : row.closeReason, createdAt: row.createdAt,
    applicant: { playerId: row.playerId, displayName: row.displayName,
      skill: row.skillLevelId ? { id: row.skillLevelId, name: row.skillName, rank: row.skillRank } : null,
      skillMismatch: row.skillRank != null && (row.skillRank < row.minRank || row.skillRank > row.maxRank) },
    // No post body/images/roster/court: application history grants no Social visibility.
    request: { hostName: row.hostName, id: row.requestId, postId: row.postId, hostId: row.hostId, matchType: row.matchType,
      startAt: row.startAt, durationMinutes: row.durationMinutes, status: row.requestStatus },
  };
}

export const applicationRepository = {
  async byId(id: number) {
    const [row] = await query().where(and(eq(rows.id, id), eq(rows.kind, 'APPLY')));
    return row ? dto(row) : null;
  },
  async list(scope: { playerId: number } | { requestId: number }, filter: ApplicationsQuery) {
    const where = and(eq(rows.kind, 'APPLY'),
      'playerId' in scope ? eq(rows.playerId, scope.playerId) : eq(rows.requestId, scope.requestId),
      filter.requestId ? eq(rows.requestId, filter.requestId) : undefined,
      filter.status ? eq(effectiveStatus, filter.status) : undefined);
    const [items, totals] = await Promise.all([
      query().where(where).orderBy(desc(rows.createdAt), desc(rows.id)).limit(filter.limit).offset((filter.page - 1) * filter.limit),
      db.select({ total: count() }).from(rows).innerJoin(requests, eq(rows.requestId, requests.id)).where(where),
    ]);
    return { items: items.map(dto), meta: { page: filter.page, limit: filter.limit, total: totals[0].total, totalPages: Math.ceil(totals[0].total / filter.limit) } };
  },
};
