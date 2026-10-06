import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { RequireAuth } from '../shared/auth/require-auth';
import { OwnerHomePage } from './placeholder-pages';
import { PlayerLayout } from '../features/player/components/PlayerLayout';
import { PlayerPlaceholderPage } from '../features/player/pages/PlayerPlaceholderPage';
import { SignInPage } from '../features/auth/sign-in-page';
import { RegisterPage } from '../features/auth/register-page';
import { ChangePasswordPage } from '../features/auth/change-password-page';
import { UserManagementPage } from '../features/admin/pages/UserManagementPage';
import { CourtManagementPage } from '../features/admin/pages/CourtManagementPage';
import { AdminPlaceholderPage } from '../features/admin/pages/AdminPlaceholderPage';
import { CourtSearchPage } from '../features/booking/pages/CourtSearchPage';
import { CourtDetailPage } from '../features/booking/pages/CourtDetailPage';
import { FacilityDetailPage } from '../features/booking/pages/FacilityDetailPage';
import { SelectDatePage } from '../features/booking/pages/SelectDatePage';
import { MyBookingsPage } from '../features/booking/pages/MyBookingsPage';
import { BookingSummaryPage } from '../features/booking/pages/BookingSummaryPage';
import { BookingPendingPage } from '../features/booking/pages/BookingPendingPage';
import { BookingDetailPage } from '../features/booking/pages/BookingDetailPage';

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
        <PlayerLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <PlayerPlaceholderPage
            title="Đây là trang chủ"
            description="Nội dung trang chủ người chơi đang được chuẩn bị."
          />
        ),
      },
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
        element: (
          <PlayerPlaceholderPage
            title="Đây là trang tìm đối thủ"
            description="Nội dung ghép cặp và tìm kiếm đối thủ đang được chuẩn bị."
          />
        ),
      },
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
        <OwnerHomePage />
      </RequireAuth>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireAuth allowedRoles={['ADMIN']}>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/users" replace /> },
      { path: 'users', element: <UserManagementPage /> },
      { path: 'courts', element: <CourtManagementPage /> },
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
      {
        path: 'reports',
        element: (
          <AdminPlaceholderPage
            title="Quản lý báo cáo & khiếu nại"
            description="Tiếp nhận và xử lý các báo cáo vi phạm FairPlay, khiếu nại trận đấu và sân bãi."
          />
        ),
      },
    ],
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
