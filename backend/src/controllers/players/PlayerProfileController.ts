import type { Request, Response, NextFunction } from 'express';
import { playerAvatarService } from '../../services/players/PlayerAvatarService';
import { UnauthorizedError } from '../../errors/AppError';
import type { PlayerProfileService } from '../../services/players/PlayerProfileService';
import { skillSurveyService } from '../../services/auth/SkillSurveyService';

export class PlayerProfileController {
  constructor(private readonly service: PlayerProfileService) {}
  private actor(req: Request): number {
    if (!req.user) throw new UnauthorizedError();
    return req.user.id;
  }
  uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ data: await playerAvatarService.upload(this.actor(req), req.file!) }); }
    catch (error) { next(error); }
  };
  own = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await this.service.read(this.actor(req)) }); } catch (error) { next(error); }
  };
  /** GET /players/me/skill-survey — own registration survey result (AUTH-30). */
  ownSkillSurvey = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await skillSurveyService.getOwnResult(this.actor(req)) }); } catch (error) { next(error); }
  };
  publicProfile = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await this.service.read(Number(req.params.id)) }); } catch (error) { next(error); }
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await this.service.updateName(this.actor(req), req.body) }); } catch (error) { next(error); }
  };
}
