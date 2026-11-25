import { z } from 'zod';

// Tournament Tech Design §3.1, §6.1 (TRN-02).

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isoDateTime = z.string().datetime({ offset: true }).transform(value => new Date(value));

export const tournamentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const tournamentFields = {
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(5000).nullable(),
  matchType: z.enum(['SINGLES', 'DOUBLES']),
  participantLimit: z.number().int().min(2).max(128),
  entryFee: z.number().int().min(0).max(10_000_000),
  minSkillLevelId: z.number().int().positive().nullable(),
  maxSkillLevelId: z.number().int().positive().nullable(),
  venueNote: z.string().trim().min(1).max(300).nullable(),
  registrationStart: isoDateTime,
  registrationEnd: isoDateTime,
  tournamentStart: isoDateTime,
  tournamentEnd: isoDateTime,
  courtCount: z.number().int().min(1).max(20),
  matchDurationMinutes: z.number().int().min(10).max(180),
  minRestMinutes: z.number().int().min(0).max(240),
  dailyStartTime: z.string().regex(HH_MM),
  dailyEndTime: z.string().regex(HH_MM),
};

export const createTournamentBodySchema = z.object({
  name: tournamentFields.name,
  description: tournamentFields.description.optional(),
  matchType: tournamentFields.matchType,
  participantLimit: tournamentFields.participantLimit.optional(),
  entryFee: tournamentFields.entryFee.default(0),
  minSkillLevelId: tournamentFields.minSkillLevelId.optional(),
  maxSkillLevelId: tournamentFields.maxSkillLevelId.optional(),
  venueNote: tournamentFields.venueNote.optional(),
  registrationStart: tournamentFields.registrationStart,
  registrationEnd: tournamentFields.registrationEnd,
  tournamentStart: tournamentFields.tournamentStart,
  tournamentEnd: tournamentFields.tournamentEnd,
  courtCount: tournamentFields.courtCount.optional(),
  matchDurationMinutes: tournamentFields.matchDurationMinutes.optional(),
  minRestMinutes: tournamentFields.minRestMinutes.optional(),
  dailyStartTime: tournamentFields.dailyStartTime.optional(),
  dailyEndTime: tournamentFields.dailyEndTime.optional(),
}).strict();

export const updateTournamentBodySchema = z.object({
  version: z.number().int().positive(),
  name: tournamentFields.name.optional(),
  description: tournamentFields.description.optional(),
  matchType: tournamentFields.matchType.optional(),
  participantLimit: tournamentFields.participantLimit.optional(),
  entryFee: tournamentFields.entryFee.optional(),
  minSkillLevelId: tournamentFields.minSkillLevelId.optional(),
  maxSkillLevelId: tournamentFields.maxSkillLevelId.optional(),
  venueNote: tournamentFields.venueNote.optional(),
  registrationStart: tournamentFields.registrationStart.optional(),
  registrationEnd: tournamentFields.registrationEnd.optional(),
  tournamentStart: tournamentFields.tournamentStart.optional(),
  tournamentEnd: tournamentFields.tournamentEnd.optional(),
  courtCount: tournamentFields.courtCount.optional(),
  matchDurationMinutes: tournamentFields.matchDurationMinutes.optional(),
  minRestMinutes: tournamentFields.minRestMinutes.optional(),
  dailyStartTime: tournamentFields.dailyStartTime.optional(),
  dailyEndTime: tournamentFields.dailyEndTime.optional(),
}).strict();

export const transitionBodySchema = z.object({
  version: z.number().int().positive(),
}).strict();

export const cancelBodySchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(300).optional(),
}).strict();

const booleanQuery = z.enum(['true', 'false']).transform(value => value === 'true');

export const listTournamentsQuerySchema = z.object({
  status: z.enum(['OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  matchType: z.enum(['SINGLES', 'DOUBLES']).optional(),
  free: booleanQuery.optional(),
  eligibleForMe: booleanQuery.optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const myTournamentsQuerySchema = z.object({
  role: z.enum(['organized', 'registered', 'invited']).default('organized'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const registrationParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  registrationId: z.coerce.number().int().positive(),
});

// Singles: `{}`; Doubles: `{ teamId }` by the captain (TRN-09).
export const registerBodySchema = z.object({ teamId: z.number().int().positive().optional() }).strict();

export const createTeamBodySchema = z.object({
  name: z.string().transform(value => value.normalize('NFC').trim()).pipe(z.string().min(2).max(60)),
}).strict();

export const teamParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  teamId: z.coerce.number().int().positive(),
});

export const teamMemberParamSchema = teamParamSchema.extend({ playerId: z.coerce.number().int().positive() });

export const inviteBodySchema = z.object({ inviteeId: z.number().int().positive() }).strict();

export const invitationParamSchema = z.object({ invitationId: z.coerce.number().int().positive() });

export const invitableQuerySchema = z.object({ q: z.string().trim().min(2).max(60) });

export const joinTokenParamSchema = z.object({ token: z.string().min(1).max(128) });

export const removeRegistrationBodySchema = z.object({
  reason: z.string().trim().min(1).max(300),
}).strict();

export const setSeedsBodySchema = z.object({
  version: z.number().int().positive(),
  seeds: z.array(z.object({
    registrationId: z.number().int().positive(),
    seedNo: z.number().int().min(1).max(128),
  }).strict()).max(128),
}).strict();

export const tournamentMatchParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  tournamentMatchId: z.coerce.number().int().positive(),
});

export const editMatchScheduleBodySchema = z.object({
  courtLabel: z.string().transform(value => value.normalize('NFC').trim()).pipe(z.string().min(1).max(40)),
  scheduledAt: isoDateTime,
}).strict();

const setScoreSchema = z.object({
  team1Score: z.number().int().min(0).max(30),
  team2Score: z.number().int().min(0).max(30),
}).strict();

export const matchResultBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SETS'), sets: z.array(setScoreSchema).min(1).max(3) }).strict(),
  z.object({ type: z.literal('RETIRED'), retiredSlot: z.union([z.literal(1), z.literal(2)]), sets: z.array(setScoreSchema).max(3) }).strict(),
  z.object({ type: z.literal('WALKOVER'), winnerSlot: z.union([z.literal(1), z.literal(2)]), reason: z.string().trim().min(1).max(255).optional() }).strict(),
  z.object({ type: z.literal('CANCEL'), reason: z.string().trim().min(1).max(255) }).strict(),
]);

export type CreateTournamentInput = z.infer<typeof createTournamentBodySchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentBodySchema>;
export type ListTournamentsQuery = z.infer<typeof listTournamentsQuerySchema>;
export type MyTournamentsQuery = z.infer<typeof myTournamentsQuerySchema>;

export const shareBodySchema = z.object({ body: z.string().max(2000).nullable().optional() }).strict();

export const playerHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const rankingQuerySchema = z.object({
  matchType: z.enum(['SINGLES', 'DOUBLES']).default('SINGLES'),
  level: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminTournamentsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  matchType: z.enum(['SINGLES', 'DOUBLES']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminCancelBodySchema = z.object({ reason: z.string().trim().min(1).max(300) }).strict();
