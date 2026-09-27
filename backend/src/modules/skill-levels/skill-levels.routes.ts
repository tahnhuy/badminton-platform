import { Router } from 'express';
import { skillLevelsController } from './skill-levels.controller';

const router = Router();

router.get('/', skillLevelsController.list);

export default router;
