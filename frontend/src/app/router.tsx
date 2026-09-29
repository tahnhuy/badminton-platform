import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { RequireAuth } from '../shared/auth/require-auth';
import { OwnerHomePage } from './placeholder-pages';
import { PlayerLayout } from '../components/player/PlayerLayout';
import { PlayerPlaceholderPage } from '../pages/player/PlayerPlaceholderPage';
import { SignInPage } from '../features/auth/sign-in-page';
import { RegisterPage } from '../features/auth/register-page';
import { ChangePasswordPage } from '../features/auth/change-password-page';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { CourtManagementPage } from '../pages/admin/CourtManagementPage';
import { AdminPlaceholderPage } from '../pages/admin/AdminPlaceholderPage';
import { CourtSearchPage } from '../pages/booking/CourtSearchPage';
import { CourtDetailPage } from '../pages/booking/CourtDetailPage';
import { MyBookingsPage } from '../pages/booking/MyBookingsPage';
import { BookingDetailPage } from '../pages/booking/BookingDetailPage';

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
        path: 'bookings',
        element: <MyBookingsPage />,
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
