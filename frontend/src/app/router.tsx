import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { RequireAuth } from '../shared/auth/require-auth';
import { PlayerHomePage, OwnerHomePage } from './placeholder-pages';
import { SignInPage } from '../features/auth/sign-in-page';
import { RegisterPage } from '../features/auth/register-page';
import { ChangePasswordPage } from '../features/auth/change-password-page';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { CourtManagementPage } from '../pages/admin/CourtManagementPage';
import { AdminPlaceholderPage } from '../pages/admin/AdminPlaceholderPage';

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

  // Role-protected routes
  {
    path: '/',
    element: (
      <RequireAuth allowedRoles={['PLAYER']}>
        <PlayerHomePage />
      </RequireAuth>
    ),
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
