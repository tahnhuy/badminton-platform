import { lazy, Suspense } from 'react';
import { SessionLoading } from '../features/auth/session-loading';

// Registration wizard and survey result are loaded on demand (AUTH-31).
const RegisterPageChunk = lazy(() => import('../features/auth/register/register-page').then(module => ({ default: module.RegisterPage })));
// Public landing page for visitors at `/` (AUTH-34).
const LandingPageChunk = lazy(() => import('../features/landing/landing-page').then(module => ({ default: module.LandingPage })));
const RegisterResultPageChunk = lazy(() => import('../features/auth/register/register-result-page').then(module => ({ default: module.RegisterResultPage })));

export function LazyRegisterPage() {
  return <Suspense fallback={<SessionLoading label="Đang tải trang…" />}><RegisterPageChunk /></Suspense>;
}

export function LazyRegisterResultPage() {
  return <Suspense fallback={<SessionLoading label="Đang tải trang…" />}><RegisterResultPageChunk /></Suspense>;
}

export function LazyLandingPage() {
  return <Suspense fallback={<SessionLoading label="Đang tải trang…" />}><LandingPageChunk /></Suspense>;
}
