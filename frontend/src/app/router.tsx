import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '../shared/auth/require-auth';
import { PlayerHomePage, OwnerHomePage, AdminHomePage } from './placeholder-pages';
import { SignInPage } from '../features/auth/sign-in-page';
import { RegisterPage } from '../features/auth/register-page';
import { ChangePasswordPage } from '../features/auth/change-password-page';

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
        <AdminHomePage />
      </RequireAuth>
    ),
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
