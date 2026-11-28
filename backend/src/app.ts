import playerContactRoutes from './routes/players/playerContactRoutes';
import ownerRoutes from './routes/owner/ownerRoutes';
import { uploadsRoot } from './shared/storage/avatar-storage';
import { createProfileRouter } from './routes/players/profileRoutes';
import express, { Express, Request, Response } from 'express';
import { env } from './shared/config/env';
import { errorHandler } from './middleware/error.middleware';
import { csrfProtection } from './middleware/csrf.middleware';
import authRouter from './routes/auth/authRoutes';
import skillLevelsRouter from './routes/skill-levels/skillLevelRoutes';
import adminUserRoutes from './routes/admin/adminUserRoutes';
import adminFacilityRoutes from './routes/admin/adminFacilityRoutes';
import adminStandardRoutes from './routes/admin/adminStandardRoutes';
import adminPartnershipRoutes from './routes/admin/adminPartnershipRoutes';
import partnershipRoutes from './routes/partnership/partnershipRoutes';
import adminGlobalSearchRoutes from './routes/admin/adminGlobalSearchRoutes';
import adminReportRoutes from './routes/admin/reportRoutes';
import reportRoutes from './routes/reports/reportRoutes';
import notificationRoutes from './routes/notifications/notificationRoutes';
import mediaRoutes from './routes/media/mediaRoutes';
import { postRouter, commentRouter, adminPostRouter, adminCommentRouter } from './routes/social/socialRoutes';
import courtRoutes from './routes/booking/courtRoutes';
import bookingRoutes from './routes/booking/bookingRoutes';
import facilityRoutes from './routes/booking/facilityRoutes';
import paymentRoutes from './routes/payments/paymentRoutes';
import matchmakingRequestRoutes from './routes/matchmaking/matchmakingRequestRoutes';
import matchInvitationRoutes from './routes/matchmaking/matchInvitationRoutes';
import applicationRoutes from './routes/matchmaking/applicationRoutes';
import matchRoutes from './routes/matchmaking/matchRoutes';
import matchRatingRoutes from './routes/ratings/matchRatingRoutes';
import userRatingRoutes from './routes/ratings/userRatingRoutes';
import { profileRatingsReader } from './services/ratings/profile-ratings-reader';
import messagingRoutes from './routes/messaging/messagingRoutes';
import walletRoutes from './routes/wallet/walletRoutes';
import adminWalletRoutes from './routes/admin/adminWalletRoutes';
import adminFinanceRoutes from './routes/admin/adminFinanceRoutes';
import adminTournamentRoutes from './routes/admin/adminTournamentRoutes';
import adminConfigRoutes from './routes/admin/adminConfigRoutes';
import adminDashboardRoutes from './routes/admin/dashboardRoutes';
import tournamentRoutes from './routes/tournaments/tournamentRoutes';
import rankingRoutes from './routes/tournaments/rankingRoutes';

export function createApp(): Express {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  // SePay bank webhook needs the raw body for HMAC verification before JSON parsing.
  app.use('/api/v1/payments/sepay/bank-webhook', express.raw({ type: '*/*' }));

  // Body parsing (JSON only; URL-encoded parsing intentionally omitted for auth routes)
  app.use(express.json());

  // Avatar files are public assets; writes require the authenticated profile upload route.
  app.use('/uploads', express.static(uploadsRoot, { dotfiles: 'deny', index: false }));

  // Basic health check route
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', message: 'Badminton Platform API is running' });
  });

  // Global CSRF protection for /api/v1
  app.use('/api/v1', csrfProtection);

  // Auth & platform modules
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/skill-levels', skillLevelsRouter);
  app.use('/api/v1/owner-requests', partnershipRoutes);
  app.use('/api/v1', messagingRoutes);
  app.use('/api/v1/players', createProfileRouter(profileRatingsReader));
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/media', mediaRoutes);
  // Social Feed (Social Tech Design §9)
  app.use('/api/v1/posts', postRouter);
  app.use('/api/v1/comments', commentRouter);
  app.use('/api/v1/admin/posts', adminPostRouter);
  app.use('/api/v1/admin/comments', adminCommentRouter);

  // Admin modules
  app.use('/api/v1/admin/users', adminUserRoutes);
  app.use('/api/v1/admin/facilities', adminFacilityRoutes);
  app.use('/api/v1/admin/standards', adminStandardRoutes);
  app.use('/api/v1/admin/owner-requests', adminPartnershipRoutes);
  app.use('/api/v1/admin/global-search', adminGlobalSearchRoutes);
  app.use('/api/v1/admin/reports', adminReportRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/admin/wallet', adminWalletRoutes);
  app.use('/api/v1/admin/finance', adminFinanceRoutes);
  app.use('/api/v1/admin/tournaments', adminTournamentRoutes);
  app.use('/api/v1/admin/configs', adminConfigRoutes);
  app.use('/api/v1/admin/dashboard', adminDashboardRoutes);

  app.use('/api/v1/owner', ownerRoutes);
  app.use('/api/v1/players', playerContactRoutes);

  // Public court discovery (booking read-path)
  app.use('/api/v1/courts', courtRoutes);
  app.use('/api/v1/facilities', facilityRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/wallet', walletRoutes);

  // Matchmaking (invitation-only)
  app.use('/api/v1/matchmaking-requests', matchmakingRequestRoutes);
  app.use('/api/v1/matchmaking-invitations', matchInvitationRoutes);
  app.use('/api/v1/matchmaking-applications', applicationRoutes);
  app.use('/api/v1/matches', matchRoutes);
  app.use('/api/v1/matches', matchRatingRoutes);

  // Tournaments (Tournament Tech Design §3)
  app.use('/api/v1/tournaments', tournamentRoutes);
  app.use('/api/v1/tournament-rankings', rankingRoutes);

  // Player Ratings
  app.use('/api/v1/users', userRatingRoutes);

  // Centralized error handler registered last
  app.use(errorHandler);

  return app;
}

export const app = createApp();

export default app;
