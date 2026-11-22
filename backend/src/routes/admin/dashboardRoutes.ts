import { Router } from 'express';
import { dashboardController } from '../../controllers/admin/DashboardController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import {
  dashboardQuerySchema,
  recentActivitiesQuerySchema,
  validateDashboardQuery,
} from '../../validation/dashboard';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/kpis', validateDashboardQuery(dashboardQuerySchema), dashboardController.kpis);
router.get('/charts', validateDashboardQuery(dashboardQuerySchema), dashboardController.charts);
router.get(
  '/recent-activities',
  validateDashboardQuery(recentActivitiesQuerySchema),
  dashboardController.recentActivities,
);

export default router;
