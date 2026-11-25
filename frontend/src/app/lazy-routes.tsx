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

// Tournament pages are loaded on demand (TRN-07/08).
const TournamentsPageChunk = lazy(() => import('../features/tournaments/pages/TournamentsPage').then(module => ({ default: module.TournamentsPage })));
const TournamentDetailPageChunk = lazy(() => import('../features/tournaments/pages/TournamentDetailPage').then(module => ({ default: module.TournamentDetailPage })));
const TournamentManagePageChunk = lazy(() => import('../features/tournaments/pages/TournamentManagePage').then(module => ({ default: module.TournamentManagePage })));
const TeamJoinPageChunk = lazy(() => import('../features/tournaments/pages/TeamJoinPage').then(module => ({ default: module.TeamJoinPage })));
const MyTournamentsPageChunk = lazy(() => import('../features/tournaments/pages/MyTournamentsPage').then(module => ({ default: module.MyTournamentsPage })));

export function LazyTournamentsPage() {
  return <Suspense fallback={<SessionLoading label="Đang tải giải đấu…" />}><TournamentsPageChunk /></Suspense>;
}

export function LazyTournamentDetailPage() {
  return <Suspense fallback={<SessionLoading label="Đang tải giải đấu…" />}><TournamentDetailPageChunk /></Suspense>;
}

export function LazyTournamentManagePage() {
  return <Suspense fallback={<SessionLoading label="Đang tải bảng điều khiển…" />}><TournamentManagePageChunk /></Suspense>;
}

export function LazyMyTournamentsPage() {
  return <Suspense fallback={<SessionLoading label="Đang tải giải của bạn…" />}><MyTournamentsPageChunk /></Suspense>;
}

export function LazyTeamJoinPage() {
  return <Suspense fallback={<SessionLoading label="Đang tải lời mời…" />}><TeamJoinPageChunk /></Suspense>;
}
