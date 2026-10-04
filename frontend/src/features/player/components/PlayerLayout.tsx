import React from 'react';
import { Outlet } from 'react-router-dom';
import { PlayerHeader } from './PlayerHeader';
import { PlayerFooter } from './PlayerFooter';

interface PlayerLayoutProps {
  children?: React.ReactNode;
}

export const PlayerLayout: React.FC<PlayerLayoutProps> = ({ children }) => {
  return (
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
      <PlayerFooter />
    </div>
  );
};
