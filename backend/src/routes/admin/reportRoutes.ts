import { Router } from 'express';
import {
  adminReportController,
  listReportsQuerySchema,
  reportIdParamSchema,
  updateReportStatusBodySchema,
} from '../../controllers/admin/AdminReportController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

// Report Management Tech Design §2.4: authenticate → requireRole('ADMIN');
// CSRF is enforced globally for /api/v1 mutations.
const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', validate({ query: listReportsQuerySchema }), adminReportController.listReports);
router.get('/:id', validate({ params: reportIdParamSchema }), adminReportController.getReport);
router.patch(
  '/:id/status',
  validate({ params: reportIdParamSchema, body: updateReportStatusBodySchema }),
  adminReportController.updateStatus,
);

export default router;
