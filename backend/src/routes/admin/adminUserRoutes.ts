import { Router } from 'express';
import {
  adminUserController,
  listUsersQuerySchema,
  userIdParamSchema,
  updateStatusBodySchema,
  setPasswordBodySchema,
  createUserBodySchema,
  bulkStatusBodySchema,
  bulkDeleteBodySchema,
} from '../../controllers/admin/AdminUserController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get(
  '/',
  validate({ query: listUsersQuerySchema }),
  adminUserController.listUsers
);

router.post(
  '/',
  validate({ body: createUserBodySchema }),
  adminUserController.createUser
);

router.patch(
  '/bulk/status',
  validate({ body: bulkStatusBodySchema }),
  adminUserController.bulkUpdateStatus
);

router.post(
  '/bulk/delete',
  validate({ body: bulkDeleteBodySchema }),
  adminUserController.bulkSoftDelete
);

router.get(
  '/:id',
  validate({ params: userIdParamSchema }),
  adminUserController.getUserById
);

router.patch(
  '/:id/status',
  validate({ params: userIdParamSchema, body: updateStatusBodySchema }),
  adminUserController.updateStatus
);

router.delete(
  '/:id',
  validate({ params: userIdParamSchema }),
  adminUserController.softDelete
);

router.post(
  '/:id/password',
  validate({ params: userIdParamSchema, body: setPasswordBodySchema }),
  adminUserController.setPassword
);

export default router;
