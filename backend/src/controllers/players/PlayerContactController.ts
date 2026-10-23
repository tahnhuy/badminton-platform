import { Request, Response, NextFunction } from 'express';
import { playerContactService } from '../../services/players/PlayerContactService';
export const playerContactController = {
  async read(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await playerContactService.read(req.user!.id) }); } catch (error) { next(error); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try { res.json({ data: await playerContactService.update(req.user!.id, req.body.phone) }); } catch (error) { next(error); }
  },
};
