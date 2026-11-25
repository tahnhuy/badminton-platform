import { Request, Response, NextFunction } from 'express';
import { tournamentService, type TournamentViewer } from '../../services/tournaments/TournamentService';
import { tournamentRegistrationService } from '../../services/tournaments/TournamentRegistrationService';
import { tournamentBracketService } from '../../services/tournaments/TournamentBracketService';
import { tournamentScheduleService } from '../../services/tournaments/TournamentScheduleService';
import { tournamentMatchService } from '../../services/tournaments/TournamentMatchService';
import { tournamentTeamService } from '../../services/tournaments/TournamentTeamService';
import { tournamentShareService } from '../../services/tournaments/TournamentShareService';
import { tournamentRankingService } from '../../services/tournaments/TournamentRankingService';
import { skillRatingService } from '../../services/tournaments/SkillRatingService';
import { tournamentRealtime, type TournamentUpdateScope } from '../../services/tournaments/TournamentRealtime';


/** Thin HTTP adapter (Tournament Tech Design §3.1). */
function viewer(req: Request): TournamentViewer | null {
  return req.user ? { id: req.user.id, role: req.user.role } : null;
}
function actor(req: Request): TournamentViewer {
  return viewer(req)!;
}
const id = (req: Request) => Number(req.params.id);
/** After a committed change: refresh open pages (TRN-15). */
const live = (req: Request, scope: TournamentUpdateScope, matchId?: number) => void tournamentRealtime.publish(id(req), scope, matchId);

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);

export const tournamentController = {
  list: wrap(async (req, res) => {
    const result = await tournamentService.list(viewer(req), req.query as never);
    res.status(200).json({ data: result.items, meta: result.meta });
  }),
  mine: wrap(async (req, res) => {
    const result = await tournamentService.mine(actor(req), req.query as never);
    res.status(200).json({ data: result.items, meta: result.meta });
  }),
  detail: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.detail(viewer(req), id(req)) });
  }),
  create: wrap(async (req, res) => {
    res.status(201).json({ data: await tournamentService.create(actor(req), req.body) });
  }),
  update: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.update(actor(req), id(req), req.body) });
    live(req, 'STATUS');
  }),
  open: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.open(actor(req), id(req), req.body.version) });
    live(req, 'STATUS');
  }),
  close: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.close(actor(req), id(req), req.body.version) });
    live(req, 'STATUS');
  }),
  cancel: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.cancel(actor(req), id(req), req.body.version, req.body.reason) });
    live(req, 'STATUS');
  }),
  participants: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentRegistrationService.participants(viewer(req), id(req)) });
  }),
  register: wrap(async (req, res) => {
    const data = req.body.teamId
      ? await tournamentTeamService.register(actor(req), id(req), req.body.teamId)
      : await tournamentRegistrationService.registerSingles(actor(req), id(req));
    res.status(201).json({ data });
    live(req, 'STATUS');
  }),
  withdraw: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentRegistrationService.withdraw(actor(req), id(req), Number(req.params.registrationId)) });
    live(req, 'STATUS');
  }),
  removeRegistration: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentRegistrationService.remove(actor(req), id(req), Number(req.params.registrationId), req.body.reason) });
    live(req, 'STATUS');
  }),
  seeds: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.getSeeds(actor(req), id(req)) });
  }),
  setSeeds: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.setSeeds(actor(req), id(req), req.body.version, req.body.seeds) });
  }),
  draw: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.draw(actor(req), id(req), req.body.version) });
    live(req, 'BRACKET');
  }),
  bracket: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentBracketService.bracket(viewer(req), id(req)) });
  }),
  schedule: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentScheduleService.schedule(viewer(req), id(req)) });
  }),
  rerunSchedule: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentScheduleService.rerun(actor(req), id(req), req.body.version) });
    live(req, 'SCHEDULE');
  }),
  editMatchSchedule: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentScheduleService.editMatch(actor(req), id(req), Number(req.params.tournamentMatchId), req.body) });
    live(req, 'SCHEDULE', Number(req.params.tournamentMatchId));
  }),
  startMatch: wrap(async (req, res) => {
    await tournamentMatchService.start(actor(req), id(req), Number(req.params.tournamentMatchId));
    res.status(200).json({ data: await tournamentBracketService.bracket(viewer(req), id(req)) });
    live(req, 'MATCH', Number(req.params.tournamentMatchId));
  }),
  matchResult: wrap(async (req, res) => {
    await tournamentMatchService.result(actor(req), id(req), Number(req.params.tournamentMatchId), req.body);
    res.status(200).json({ data: await tournamentBracketService.bracket(viewer(req), id(req)) });
    live(req, 'MATCH', Number(req.params.tournamentMatchId));
  }),
  createTeam: wrap(async (req, res) => {
    res.status(201).json({ data: await tournamentTeamService.create(actor(req), id(req), req.body.name) });
  }),
  myTeam: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.mine(actor(req), id(req)) });
  }),
  invite: wrap(async (req, res) => {
    res.status(201).json({ data: await tournamentTeamService.invite(actor(req), id(req), Number(req.params.teamId), req.body.inviteeId) });
  }),
  inviteLink: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.inviteLink(actor(req), id(req), Number(req.params.teamId)) });
  }),
  leaveTeam: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.leave(actor(req), id(req), Number(req.params.teamId)) });
  }),
  removeTeamMember: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.removeMember(actor(req), id(req), Number(req.params.teamId), Number(req.params.playerId)) });
  }),
  invitablePlayers: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.invitable(actor(req), id(req), String(req.query.q)) });
  }),
  acceptInvitation: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.accept(actor(req), Number(req.params.invitationId)) });
  }),
  declineInvitation: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.close(actor(req), Number(req.params.invitationId), 'decline') });
  }),
  cancelInvitation: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.close(actor(req), Number(req.params.invitationId), 'cancel') });
  }),
  joinPreview: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.joinPreview(actor(req), String(req.params.token)) });
  }),
  join: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentTeamService.join(actor(req), String(req.params.token)) });
  }),
  share: wrap(async (req, res) => {
    res.status(201).json({ data: await tournamentShareService.share(actor(req), id(req), req.body.body) });
  }),
  playerHistory: wrap(async (req, res) => {
    const query = req.query as unknown as { page: number; limit: number };
    const result = await tournamentShareService.history(Number(req.params.id), query.page, query.limit);
    res.status(200).json({ data: result.items, meta: result.meta });
  }),
  ownSkillRating: wrap(async (req, res) => {
    res.status(200).json({ data: await skillRatingService.own(actor(req).id) });
  }),
  rankings: wrap(async (req, res) => {
    const q = req.query as unknown as { matchType: 'SINGLES' | 'DOUBLES'; level?: number; page: number; limit: number };
    const result = await tournamentRankingService.leaderboard({ matchType: q.matchType, levelId: q.level, page: q.page, limit: q.limit });
    res.status(200).json({ data: result.items, meta: result.meta });
  }),
  playerRanking: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentRankingService.ofPlayer(Number(req.params.id)) });
  }),
  adminList: wrap(async (req, res) => {
    const result = await tournamentService.adminList(req.query as never);
    res.status(200).json({ data: result.items, meta: result.meta });
  }),
  adminCancel: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.adminCancel(actor(req), id(req), req.body.reason) });
    live(req, 'STATUS');
  }),
  adminRecalculateRatings: wrap(async (_req, res) => {
    res.status(200).json({ data: await skillRatingService.recalculateAll() });
  }),
  complete: wrap(async (req, res) => {
    res.status(200).json({ data: await tournamentService.complete(actor(req), id(req), req.body.version) });
    live(req, 'STATUS');
  }),
};
