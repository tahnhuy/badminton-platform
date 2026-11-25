/** API shapes of `/api/v1/tournaments` (Tournament Tech Design §3). */

export type TournamentStatus =
  | 'DRAFT' | 'OPEN_FOR_REGISTRATION' | 'REGISTRATION_CLOSED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MatchType = 'SINGLES' | 'DOUBLES';
export type IneligibleReason = 'NOT_SIGNED_IN' | 'NOT_PLAYER' | 'ORGANIZER' | 'BELOW_MIN_LEVEL' | 'ABOVE_MAX_LEVEL';

export interface SkillLevelRef { id: number; code: string; name: string; rank: number }

export interface TournamentSchedule {
  courtCount: number;
  matchDurationMinutes: number;
  minRestMinutes: number;
  dailyStartTime: string;
  dailyEndTime: string;
}

export interface Tournament {
  id: number;
  name: string;
  description: string | null;
  format: string;
  matchType: MatchType;
  competitionType: string;
  status: TournamentStatus;
  participantLimit: number;
  confirmedCount: number;
  slotsLeft: number;
  entryFee: number;
  minSkillLevel: SkillLevelRef | null;
  maxSkillLevel: SkillLevelRef | null;
  venueNote: string | null;
  registrationStart: string;
  registrationEnd: string;
  tournamentStart: string;
  tournamentEnd: string;
  schedule: TournamentSchedule;
  organizer: { id: number; fullName: string; avatarUrl: string | null } | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
}

export interface TournamentDetail extends Tournament {
  /** The tournament group chat, only for its members (TRN-16). */
  conversationId: number | null;
  viewer: {
    isOrganizer: boolean; registrationId: number | null; eligible: boolean; ineligibleReason: IneligibleReason | null;
    canShare: boolean; sharedPostId: number | null;
  };
}

export interface Page<T> { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } }

export interface PlayerRef { id: number; fullName: string; avatarUrl: string | null }

export interface Participant {
  registrationId: number;
  seedNo: number | null;
  registeredAt: string;
  teamName: string | null;
  players: Array<PlayerRef & { skillLevel: { code: string; name: string; rank: number } | null }>;
}

export interface Registration {
  id: number;
  tournamentId: number;
  registrationType: MatchType;
  status: string;
  paidAmount: number;
  registeredAt: string;
  refundedAt: string | null;
}

export interface BracketSlot {
  registrationId: number | null;
  seedNo: number | null;
  teamName: string | null;
  players: PlayerRef[];
  fromBye: boolean;
}

export type MatchResolution = 'UNRESOLVED' | 'WINNER_DECLARED' | 'RETIRED' | 'WALKOVER' | 'NONE';
export type MatchStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface BracketMatch {
  id: number;
  roundIndex: number;
  matchIndex: number;
  slot1: BracketSlot;
  slot2: BracketSlot;
  winnerRegistrationId: number | null;
  resolution: MatchResolution;
  status: MatchStatus;
  scheduledAt: string;
  courtLabel: string | null;
  startedAt: string | null;
  completedAt: string | null;
  sets: Array<{ setNo: number; team1Score: number; team2Score: number }>;
  nextMatchId: number | null;
}

export interface Bracket {
  generated: boolean;
  totalRounds: number;
  drawSeed?: number | null;
  rounds: Array<{ roundIndex: number; matches: BracketMatch[] }>;
}

export type ScheduleWarningCode =
  | 'COURT_OVERLAP' | 'PARTICIPANT_OVERLAP' | 'REST_TOO_SHORT' | 'BEFORE_FEEDER' | 'OUTSIDE_DAILY_WINDOW' | 'OUTSIDE_TOURNAMENT_DATES';

export interface ScheduleWarning { matchId: number; code: ScheduleWarningCode; otherMatchId?: number; participantId?: number }

export interface ScheduleItem {
  id: number;
  roundIndex: number;
  matchIndex: number;
  registration1Id: number | null;
  registration2Id: number | null;
  winnerRegistrationId: number | null;
  status: MatchStatus;
  resolution: MatchResolution;
  courtLabel: string | null;
  scheduledAt: string;
  estimatedEndAt: string;
}

export interface TournamentScheduleView {
  matchDurationMinutes: number;
  courtCount: number;
  matches: ScheduleItem[];
  warnings?: ScheduleWarning[];
}

export interface SeedEntry {
  registrationId: number;
  seedNo: number | null;
  suggestedSeedNo: number;
  skillRank: number;
  teamName: string | null;
  players: Array<PlayerRef & { rank: number | null }>;
}

export interface SeedsView { editable: boolean; version: number; entries: SeedEntry[] }

export interface SetScore { team1Score: number; team2Score: number }

export type ResultInput =
  | { type: 'SETS'; sets: SetScore[] }
  | { type: 'RETIRED'; retiredSlot: 1 | 2; sets: SetScore[] }
  | { type: 'WALKOVER'; winnerSlot: 1 | 2; reason?: string }
  | { type: 'CANCEL'; reason: string };

export interface TournamentInput {
  name: string;
  description?: string | null;
  matchType: MatchType;
  participantLimit?: number;
  entryFee: number;
  minSkillLevelId?: number | null;
  maxSkillLevelId?: number | null;
  venueNote?: string | null;
  registrationStart: string;
  registrationEnd: string;
  tournamentStart: string;
  tournamentEnd: string;
  courtCount?: number;
  matchDurationMinutes?: number;
  minRestMinutes?: number;
  dailyStartTime?: string;
  dailyEndTime?: string;
}

export interface ListFilters {
  status?: TournamentStatus;
  matchType?: MatchType;
  free?: boolean;
  eligibleForMe?: boolean;
  q?: string;
  page: number;
}

// ------------------------------------------------------------------ Doubles teams (TRN-09)

export interface TeamMember extends PlayerRef { role: 'CAPTAIN' | 'MEMBER'; skillLevel: { name: string; rank: number } | null }
export interface TeamInvitation {
  id: number; status: string; expiresAt: string; createdAt: string;
  team: { id: number; name: string; tournamentId: number };
  inviter: PlayerRef; invitee: PlayerRef;
}
export interface Team {
  id: number; tournamentId: number; name: string; status: 'FORMING' | 'FULL' | 'REGISTERED' | 'DISBANDED'; captainId: number;
  members: TeamMember[]; pendingInvitation: TeamInvitation | null; hasInviteLink: boolean; registrationId: number | null;
}
export interface MyTeam { team: Team | null; invitations: TeamInvitation[] }
export interface InvitablePlayer extends PlayerRef { skillLevel: { name: string; rank: number } }
export type JoinReason = 'TEAM_FULL' | 'REGISTRATION_CLOSED' | 'ALREADY_IN_TEAM' | 'ORGANIZER' | 'OWN_TEAM' | 'BLOCKED' | 'NOT_PLAYER' | 'BELOW_MIN_LEVEL' | 'ABOVE_MAX_LEVEL';
export interface JoinPreview {
  tournament: { id: number; name: string; status: TournamentStatus; entryFee: number; tournamentStart: string };
  team: { id: number; name: string; status: string; captain: PlayerRef };
  canJoin: boolean; reason: JoinReason | null;
}

// ------------------------------------------------------------------ Profile history (TRN-16)

export interface TournamentHistoryItem {
  tournament: { id: number; name: string; matchType: MatchType; tournamentStart: string; completedAt: string | null };
  placement: string | null;
  teamName: string | null;
  partner: PlayerRef | null;
  rankingPoints: number | null;
}

// ------------------------------------------------------------------ Skill rating (TRN-14) and ranking (TRN-18)

export interface SkillRatingView {
  rating: number; tentative: boolean; ratedMatchCount: number;
  level: { id: number; name: string; rank: number };
  band: { min: number; max: number };
  next: { name: string; threshold: number; remaining: number } | null;
  previous: { name: string; threshold: number } | null;
  events: Array<{ tournament: { id: number; name: string }; tournamentMatchId: number; before: number; after: number; opponent: number; expected: number; outcome: 0 | 1; at: string }>;
  changes: Array<{ from: string; to: string; rating: number; reason: string; tournament: { id: number; name: string } | null; at: string }>;
}

export interface LeaderboardRow {
  position: number;
  player: PlayerRef & { level: { id: number; name: string; rank: number } | null };
  totalPoints: number; tournamentsCounted: number; bestPoints: number;
}

export type PlayerRanking = Record<'SINGLES' | 'DOUBLES', { position: number; totalPoints: number; tournamentsCounted: number } | null>;
