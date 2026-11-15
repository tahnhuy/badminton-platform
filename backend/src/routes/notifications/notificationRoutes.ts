import { Router } from 'express';
import {
  notificationController,
  listNotificationsQuerySchema,
  unreadNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../../controllers/notifications/NotificationController';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

// Notifications Tech Design (NTF-03). Any authenticated account reads only its own
// notifications; CSRF is enforced globally for /api/v1 mutations. No bulk-read endpoint.
const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);
router.get('/unread', validate({ query: unreadNotificationsQuerySchema }), notificationController.listUnread);
router.get('/:id', validate({ params: notificationIdParamSchema }), notificationController.get);
router.post('/:id/read', validate({ params: notificationIdParamSchema }), notificationController.markRead);

export default router;
