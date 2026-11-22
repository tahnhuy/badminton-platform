import { Router } from 'express';
import { reportController, createReportBodySchema } from '../../controllers/reports/ReportController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

// RP-06: Player report creation only. Admin and Court Owner use other moderation
// surfaces; CSRF is enforced globally for /api/v1 mutations.
const router = Router();
router.use(authenticate, requireRole('PLAYER'));

router.post('/', validate({ body: createReportBodySchema }), reportController.create);

export default router;
