import { Router } from 'express';
import { skillLevelsController } from '../../controllers/skill-levels/SkillLevelController';

const router = Router();

router.get('/', skillLevelsController.list);

export default router;
