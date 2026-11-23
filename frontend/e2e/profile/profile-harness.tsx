import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/features/auth/auth-provider';
import '../../src/index.css';
import { createRoot } from 'react-dom/client';
import { PlayerProfilePage } from '../../src/features/player/profile/PlayerProfilePage';
import { PlayerProfileModal } from '../../src/features/player/profile/PlayerProfileModal';
import { ProfileProvider } from '../../src/features/player/profile/ProfileProvider';
import { useOwnPlayerProfile } from '../../src/features/player/profile/profile-context';
import { httpClient } from '../../src/shared/api/http-client';

export function SharedIdentity() {
  const { profile, retry } = useOwnPlayerProfile();
  return <><p data-testid="shared-profile-name">{profile?.fullName}</p><button onClick={retry}>Refresh shared profile</button></>;
}
export function Harness() {
  const [id, setId] = useState<number | null>(null);
  const [transport, setTransport] = useState('');
  async function sendMultipart() {
    const body = new FormData(); body.append('avatar', new Blob(['test-image'], { type: 'image/png' }), 'avatar.png');
    await httpClient('/api/v1/test-profile-transport', { method: 'POST', body }); setTransport('Uploaded');
  }
  return <><button onClick={() => setId(2)}>View player 2</button><button onClick={() => setId(3)}>View player 3</button>
    {id !== null && <PlayerProfileModal playerId={id} onClose={() => setId(null)} />}
    <ProfileProvider avatarUploadEnabled><SharedIdentity /><PlayerProfilePage /></ProfileProvider><button onClick={sendMultipart}>Test multipart transport</button><p>{transport}</p></>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><Harness /></AuthProvider></BrowserRouter>);
