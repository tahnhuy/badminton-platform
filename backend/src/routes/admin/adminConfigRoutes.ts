import { Router } from 'express';
import {
  adminConfigController,
  configKeyParamSchema,
  listConfigsQuerySchema,
  updateConfigBodySchema,
} from '../../controllers/admin/AdminConfigController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', validate({ query: listConfigsQuerySchema }), adminConfigController.listConfigs);
router.get('/:configKey', validate({ params: configKeyParamSchema }), adminConfigController.getConfig);
router.patch(
  '/:configKey',
  validate({ params: configKeyParamSchema, body: updateConfigBodySchema }),
  adminConfigController.updateConfig,
);

export default router;
