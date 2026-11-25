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

// `teamId` (Doubles) is added with TRN-09; until then any field is rejected.
export const registerBodySchema = z.object({}).strict();

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

export type CreateTournamentInput = z.infer<typeof createTournamentBodySchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentBodySchema>;
export type ListTournamentsQuery = z.infer<typeof listTournamentsQuerySchema>;
export type MyTournamentsQuery = z.infer<typeof myTournamentsQuerySchema>;
