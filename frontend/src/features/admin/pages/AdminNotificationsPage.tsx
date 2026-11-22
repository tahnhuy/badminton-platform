import React from 'react';
import { AdminNotificationLayout } from '../components/AdminNotificationLayout';
import { NotificationsPage } from '../../notifications/pages/NotificationsPage';

export const AdminNotificationsPage: React.FC = () => (
  <AdminNotificationLayout>
    <NotificationsPage basePath="/admin/notifications" />
  </AdminNotificationLayout>
);
