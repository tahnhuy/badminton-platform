import { Router } from 'express';
import { adminGlobalSearchController } from '../../controllers/admin/AdminGlobalSearchController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', (req, res, next) => {
  adminGlobalSearchController.search(req, res, next);
});

export default router;
