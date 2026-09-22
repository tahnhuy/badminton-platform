import { Router } from 'express';
import { adminGlobalSearchController } from '../../controllers/admin/AdminGlobalSearchController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// [TEMP AUTH BYPASS] Auth module not implemented yet. Re-enable requireRole('ADMIN') once Auth lands.
router.use(authenticate);
// router.use(authenticate, requireRole('ADMIN'));

router.get('/', (req, res, next) => {
  adminGlobalSearchController.search(req, res, next);
});

export default router;
