import { lazy } from 'react';

export const FacilityReviewPage = lazy(() => import('../features/admin/pages/FacilityReviewPage').then(module => ({ default: module.FacilityReviewPage })));
export const FacilityApprovalPage = lazy(() => import('../features/admin/pages/FacilityApprovalPage').then(module => ({ default: module.FacilityApprovalPage })));
export const StandardClaimReviewPage = lazy(() => import('../features/admin/pages/StandardClaimReviewPage').then(module => ({ default: module.StandardClaimReviewPage })));
export const UserManagementPage = lazy(() => import('../features/admin/pages/UserManagementPage').then(module => ({ default: module.UserManagementPage })));
export const CourtManagementPage = lazy(() => import('../features/admin/pages/CourtManagementPage').then(module => ({ default: module.CourtManagementPage })));
export const AdminPlaceholderPage = lazy(() => import('../features/admin/pages/AdminPlaceholderPage').then(module => ({ default: module.AdminPlaceholderPage })));
export const AdminDashboardPage = lazy(() => import('../features/admin/dashboard/pages/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
export const ReportManagementPage = lazy(() => import('../features/admin/reports/pages/ReportManagementPage').then(module => ({ default: module.ReportManagementPage })));
export const SystemConfigPage = lazy(() => import('../features/admin/configs/pages/SystemConfigPage').then(module => ({ default: module.SystemConfigPage })));
export const AdminFinancePage = lazy(() => import('../features/admin/finance/AdminFinancePage').then(module => ({ default: module.AdminFinancePage })));
export const AdminNotificationsPage = lazy(() => import('../features/admin/pages/AdminNotificationsPage').then(module => ({ default: module.AdminNotificationsPage })));
export const AdminNotificationDetailPage = lazy(() => import('../features/admin/pages/AdminNotificationDetailPage').then(module => ({ default: module.AdminNotificationDetailPage })));

export const AdminTournamentsPage = lazy(() => import('../features/tournaments/pages/AdminTournamentsPage').then(module => ({ default: module.AdminTournamentsPage })));
