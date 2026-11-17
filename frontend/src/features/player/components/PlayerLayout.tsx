import React from 'react';
import { Outlet } from 'react-router-dom';
import { PlayerHeader } from './PlayerHeader';
import { PlayerFooter } from './PlayerFooter';
import { GlobalChatDock } from '../../messaging/components/GlobalChatDock';
import { NotificationsProvider } from '../../notifications/notifications-context';

interface PlayerLayoutProps {
  children?: React.ReactNode;
}

export const PlayerLayout: React.FC<PlayerLayoutProps> = ({ children }) => {
  return (
    <NotificationsProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app, #FAF8FF)',
        }}
      >
        <PlayerHeader />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children || <Outlet />}
        </main>
        <GlobalChatDock />
        <PlayerFooter />
      </div>
    </NotificationsProvider>
  );
};
