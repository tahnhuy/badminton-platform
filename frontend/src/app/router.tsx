import { FacilityReviewPage } from '../features/admin/pages/FacilityReviewPage';
import { PlayerContactPage } from '../features/player/profile/PlayerContactPage';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { RequireAuth } from '../shared/auth/require-auth';
import { OwnerLayout } from '../features/court-owner/pages/OwnerLayout';
import { OwnerDashboard } from '../features/court-owner/pages/OwnerDashboard';
import { OwnerFacilityPage } from '../features/court-owner/pages/OwnerFacilityPage';
import { OwnerPricingPage } from '../features/court-owner/pages/OwnerPricingPage';
import { OwnerSchedulePage } from '../features/court-owner/pages/OwnerSchedulePage';
import { OwnerAccountPage } from '../features/court-owner/pages/OwnerAccountPage';
import { PlayerProfilePage } from '../features/player/profile/PlayerProfilePage';
import { PlayerProfileLayout } from '../features/player/components/PlayerProfileLayout';
import { PlayerPlaceholderPage } from '../features/player/pages/PlayerPlaceholderPage';
import { SignInPage } from '../features/auth/sign-in-page';
import { RegisterPage } from '../features/auth/register-page';
import { ChangePasswordPage } from '../features/auth/change-password-page';
import { UserManagementPage } from '../features/admin/pages/UserManagementPage';
import { CourtManagementPage } from '../features/admin/pages/CourtManagementPage';
import { AdminPlaceholderPage } from '../features/admin/pages/AdminPlaceholderPage';
import { ReportManagementPage } from '../features/admin/reports/pages/ReportManagementPage';
import { SystemConfigPage } from '../features/admin/configs/pages/SystemConfigPage';
import { AdminWalletPage } from '../features/admin/wallet/AdminWalletPage';
import { AdminNotificationsPage } from '../features/admin/pages/AdminNotificationsPage';
import { AdminNotificationDetailPage } from '../features/admin/pages/AdminNotificationDetailPage';
import { CourtSearchPage } from '../features/booking/pages/CourtSearchPage';
import { CourtDetailPage } from '../features/booking/pages/CourtDetailPage';
import { FacilityDetailPage } from '../features/booking/pages/FacilityDetailPage';
import { SelectDatePage } from '../features/booking/pages/SelectDatePage';
import { MyBookingsPage } from '../features/booking/pages/MyBookingsPage';
import { BookingSummaryPage } from '../features/booking/pages/BookingSummaryPage';
import { BookingPendingPage } from '../features/booking/pages/BookingPendingPage';
import { BookingDetailPage } from '../features/booking/pages/BookingDetailPage';
import { MatchmakingRequestDetailPage } from '../features/matchmaking/pages/MatchmakingRequestDetailPage';
import { MatchmakingInvitationsPage } from '../features/matchmaking/pages/MatchmakingInvitationsPage';
import { MatchDetailPage } from '../features/matchmaking/pages/MatchDetailPage';
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

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/sign-in',
    element: <SignInPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/change-password',
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },

  // Role-protected routes for Player
  {
    path: '/',
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
      {
        index: true,
        element: (
          <PlayerPlaceholderPage
            title="Đây là trang chủ"
            description="Nội dung trang chủ người chơi đang được chuẩn bị."
          />
        ),
      },
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
      { path: 'matchmaking/requests/:requestId', element: <MatchmakingRequestDetailPage /> },
      { path: 'matchmaking/invitations', element: <MatchmakingInvitationsPage /> },
      { path: 'matchmaking/matches', element: <MyMatchesPage /> },
      { path: 'matchmaking/matches/:matchId', element: <MatchDetailPage /> },
      { path: 'ratings/given', element: <RatingsGivenPage /> },
      { path: 'messages', element: <MessagingWorkspacePage /> },
      { path: 'messages/:conversationId', element: <MessagingWorkspacePage /> },
      { path: 'settings/blocks', element: <BlockListPage /> },
      {
        path: 'tournaments',
        element: (
          <PlayerPlaceholderPage
            title="Đây là trang giải đấu"
            description="Nội dung quản lý và tham gia giải đấu đang được chuẩn bị."
          />
        ),
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
      { path: 'account', element: <OwnerAccountPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireAuth allowedRoles={['ADMIN']}>
        <NotificationsProvider>
          <Outlet />
        </NotificationsProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/users" replace /> },
      { path: 'users', element: <UserManagementPage /> },
      { path: 'courts', element: <CourtManagementPage /> },
      { path: 'courts/:facilityId/reviews', element: <FacilityReviewPage /> },
      {
        path: 'dashboard',
        element: (
          <AdminPlaceholderPage
            title="Bảng điều khiển"
            description="Tổng quan số liệu thống kê vận hành, doanh thu và các chỉ số toàn hệ thống."
          />
        ),
      },
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
      { path: 'wallet', element: <Navigate to="/admin/wallet/payouts" replace /> },
      { path: 'wallet/payouts', element: <AdminWalletPage section="payouts" /> },
      { path: 'wallet/refunds', element: <AdminWalletPage section="refunds" /> },
      { path: 'wallet/reconciliation', element: <AdminWalletPage section="reconciliation" /> },
      { path: 'notifications/:id', element: <AdminNotificationDetailPage /> },
    ],
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
