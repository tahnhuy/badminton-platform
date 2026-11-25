import { FacilityReviewPage, FacilityApprovalPage, UserManagementPage, CourtManagementPage, AdminPlaceholderPage, AdminDashboardPage, ReportManagementPage, SystemConfigPage, AdminFinancePage, AdminNotificationsPage, AdminNotificationDetailPage } from './admin-pages';
import { Suspense } from 'react';

import { PlayerContactPage } from '../features/player/profile/PlayerContactPage';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  LazyMyTournamentsPage, LazyRankingsPage, LazyRegisterPage, LazyTeamJoinPage, LazyRegisterResultPage, LazyTournamentDetailPage, LazyTournamentManagePage, LazyTournamentsPage,
} from './lazy-routes';
import { HomeGate } from './home-gate';
import { RequireAuth } from '../shared/auth/require-auth';
import { OwnerLayout } from '../features/court-owner/pages/OwnerLayout';
import { OwnerDashboard } from '../features/court-owner/pages/OwnerDashboard';
import { OwnerFacilityPage } from '../features/court-owner/pages/OwnerFacilityPage';
import { OwnerPricingPage } from '../features/court-owner/pages/OwnerPricingPage';
import { OwnerSchedulePage } from '../features/court-owner/pages/OwnerSchedulePage';
import { OwnerAccountPage } from '../features/court-owner/pages/OwnerAccountPage';
import { OwnerWalletPage } from '../features/court-owner/pages/OwnerWalletPage';
import { PlayerProfilePage } from '../features/player/profile/PlayerProfilePage';
import { PlayerProfileLayout } from '../features/player/components/PlayerProfileLayout';
import { SignInPage } from '../features/auth/sign-in-page';
import { ChangePasswordPage } from '../features/auth/change-password-page';

import { CourtSearchPage } from '../features/booking/pages/CourtSearchPage';
import { CourtDetailPage } from '../features/booking/pages/CourtDetailPage';
import { FacilityDetailPage } from '../features/booking/pages/FacilityDetailPage';
import { SelectDatePage } from '../features/booking/pages/SelectDatePage';
import { MyBookingsPage } from '../features/booking/pages/MyBookingsPage';
import { BookingSummaryPage } from '../features/booking/pages/BookingSummaryPage';
import { BookingPendingPage } from '../features/booking/pages/BookingPendingPage';
import { BookingDetailPage } from '../features/booking/pages/BookingDetailPage';
import { MatchmakingRequestDetailPage } from '../features/matchmaking/pages/MatchmakingRequestDetailPage';
import { MatchmakingActivityPage } from '../features/matchmaking/pages/MatchmakingActivityPage';
import { MatchDetailPage } from '../features/matchmaking/pages/MatchDetailPage';
import { MatchCourtBookingPage } from '../features/matchmaking/pages/MatchCourtBookingPage';
import { MyMatchesPage } from '../features/matchmaking/pages/MyMatchesPage';
import { MatchmakingPage } from '../features/matchmaking/pages/MatchmakingPage';
import { RatingsGivenPage } from '../features/ratings/pages/RatingsGivenPage';
import { FeedPage } from '../features/social/pages/FeedPage';
import { WalletPage } from '../features/wallet/pages/WalletPage';
import { PostDetailPage } from '../features/social/pages/PostDetailPage';
import { MessagingWorkspacePage } from '../features/messaging/pages/MessagingWorkspacePage';
import { BlockListPage } from '../features/messaging/pages/BlockListPage';
import { NotificationsPage } from '../features/notifications/pages/NotificationsPage';
import { NotificationDetailPage } from '../features/notifications/pages/NotificationDetailPage';
import { NotificationsProvider } from '../features/notifications/notifications-context';
import { AdminTimeRangeProvider } from '../features/admin/contexts/admin-time-range';

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

/** Old invitations page now lives inside Hoạt động của tôi. */
function MatchmakingInvitationsRedirect() {
  const location = useLocation();
  const direction = new URLSearchParams(location.search).get('direction');
  return <Navigate to={{ pathname: '/matchmaking/activity', search: direction === 'SENT' ? '?section=created' : '', hash: '#invitations' }} replace />;
}

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/sign-in',
    element: <SignInPage />,
  },
  {
    path: '/register',
    element: <LazyRegisterPage />,
  },
  {
    // Survey result, outside PlayerLayout (frontend.md §4.2). Right after registration it
    // is shown without a session; a later visit is PLAYER-only (guarded inside the page).
    path: '/register/result',
    element: <LazyRegisterResultPage />,
  },
  {
    path: '/change-password',
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },

  {
    path: '/',
    children: [
      // Public index (AUTH-34): visitor → landing page; signed-in → role home.
      { index: true, element: <HomeGate /> },
      // Role-protected routes for Player (pathless layout: every child keeps the guard).
      {
        element: (
          <RequireAuth allowedRoles={['PLAYER']}>
            <PlayerProfileLayout />
          </RequireAuth>
        ),
        children: [
          { path: 'feed', element: <FeedPage /> },
          { path: 'posts/:postId', element: <PostDetailPage /> },
          { path: 'profile/contact', element: <PlayerContactPage /> },
          { path: 'wallet', element: <WalletPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'notifications/:id', element: <NotificationDetailPage /> },
          { path: 'profile', element: <PlayerProfilePage /> },
          {
            path: 'courts',
            element: <CourtSearchPage />,
          },
          {
            path: 'courts/:courtId',
            element: <CourtDetailPage />,
          },
          {
            path: 'courts/:courtId/date',
            element: <SelectDatePage />,
          },
          {
            path: 'facilities/:facilityId',
            element: <FacilityDetailPage />,
          },
          {
            path: 'bookings',
            element: <MyBookingsPage />,
          },
          {
            path: 'bookings/new',
            element: <BookingSummaryPage />,
          },
          {
            path: 'bookings/:bookingId/pending',
            element: <BookingPendingPage />,
          },
          {
            path: 'bookings/:bookingId',
            element: <BookingDetailPage />,
          },
          {
            path: 'matchmaking',
            element: <MatchmakingPage />,
          },
          { path: 'matchmaking/activity', element: <MatchmakingActivityPage /> },
          { path: 'matchmaking/requests/:requestId', element: <MatchmakingRequestDetailPage /> },
          { path: 'matchmaking/invitations', element: <MatchmakingInvitationsRedirect /> },
          { path: 'matchmaking/matches', element: <MyMatchesPage /> },
          { path: 'matchmaking/matches/:matchId', element: <MatchDetailPage /> },
          { path: 'matchmaking/matches/:matchId/book', element: <MatchCourtBookingPage /> },
          { path: 'ratings/given', element: <RatingsGivenPage /> },
          { path: 'messages', element: <MessagingWorkspacePage /> },
          { path: 'messages/:conversationId', element: <MessagingWorkspacePage /> },
          { path: 'settings/blocks', element: <BlockListPage /> },
          { path: 'tournaments', element: <LazyTournamentsPage /> },
          { path: 'tournaments/new', element: <LazyTournamentManagePage /> },
          { path: 'tournaments/mine', element: <LazyMyTournamentsPage /> },
          { path: 'tournaments/rankings', element: <LazyRankingsPage /> },
          { path: 'tournaments/join/:token', element: <LazyTeamJoinPage /> },
          { path: 'tournaments/:id', element: <LazyTournamentDetailPage /> },
          { path: 'tournaments/:id/manage', element: <LazyTournamentManagePage /> },
        ],
      },
    ],
  },
  {
    path: '/owner',
    element: (
      <RequireAuth allowedRoles={['COURT_OWNER']}>
        <OwnerLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <OwnerDashboard /> },
      { path: 'facilities', element: <OwnerFacilityPage /> },
      { path: 'pricing', element: <OwnerPricingPage /> },
      { path: 'schedule', element: <OwnerSchedulePage /> },
      { path: 'wallet', element: <OwnerWalletPage /> },
      { path: 'account', element: <OwnerAccountPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireAuth allowedRoles={['ADMIN']}>
        <AdminTimeRangeProvider>
          <NotificationsProvider>
            <Suspense fallback={<p role="status" className="p-6 text-muted-foreground">Đang tải trang quản trị…</p>}><Outlet /></Suspense>
          </NotificationsProvider>
        </AdminTimeRangeProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'users', element: <UserManagementPage /> },
      { path: 'courts', element: <CourtManagementPage /> },
      { path: 'courts/:facilityId/reviews', element: <FacilityReviewPage /> },
      { path: 'approvals', element: <FacilityApprovalPage /> },
      { path: 'dashboard', element: <AdminDashboardPage /> },
      {
        path: 'tournaments',
        element: (
          <AdminPlaceholderPage
            title="Quản lý giải đấu"
            description="Giám sát các giải đấu phong trào, chuyên nghiệp, bảng đấu và trọng tài."
          />
        ),
      },
      { path: 'reports', element: <ReportManagementPage /> },
      { path: 'configs', element: <SystemConfigPage /> },
      { path: 'notifications', element: <AdminNotificationsPage /> },
      { path: 'finance', element: <Navigate to="/admin/finance/overview" replace /> },
      { path: 'finance/:section', element: <AdminFinancePage /> },
      { path: 'wallet', element: <RedirectWithSearch to="/admin/finance/payouts" /> },
      { path: 'wallet/payouts', element: <RedirectWithSearch to="/admin/finance/payouts" /> },
      { path: 'wallet/refunds', element: <RedirectWithSearch to="/admin/finance/refunds" /> },
      { path: 'wallet/reconciliation', element: <RedirectWithSearch to="/admin/finance/reconciliation" /> },
      { path: 'notifications/:id', element: <AdminNotificationDetailPage /> },
    ],
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
