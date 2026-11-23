import React from 'react';
import { AdminNotificationLayout } from '../components/AdminNotificationLayout';
import { NotificationDetailPage } from '../../notifications/pages/NotificationDetailPage';

export const AdminNotificationDetailPage: React.FC = () => (
  <AdminNotificationLayout>
    <NotificationDetailPage basePath="/admin/notifications" />
  </AdminNotificationLayout>
);
