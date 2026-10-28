import { useCallback, useEffect, useRef, useState } from 'react';
import { profileApi, profileError, type PlayerProfile } from './profile-api';

interface ProfileState { key: string; profile: PlayerProfile | null; error: string | null }
export function usePlayerProfile(playerId?: number) {
  const [revision, setRevision] = useState(0);
  const key = `${playerId ?? 'me'}:${revision}`;
  const [state, setState] = useState<ProfileState | null>(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const version = ++requestVersion.current;
    const request = playerId === undefined ? profileApi.own(controller.signal) : profileApi.publicProfile(playerId, controller.signal);
    request.then(profile => {
      if (version === requestVersion.current && !controller.signal.aborted) setState({ key, profile, error: null });
    }).catch(reason => {
      if (version === requestVersion.current && !controller.signal.aborted) setState({ key, profile: null, error: profileError(reason) });
    });
    return () => { controller.abort(); };
  }, [playerId, key]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  const acceptUpdatedProfile = useCallback((profile: PlayerProfile) => {
    // PATCH mutates name only; preserve an avatar uploaded while that request was in flight.
    // A mutation from before retry must not replace or cancel the newer profile read.
    setState(current => current?.key === key && current.profile
      ? { ...current, profile: { ...current.profile, fullName: profile.fullName } } : current);
  }, [key]);
  const acceptAvatar = useCallback((avatarUrl: string) => {
    setState(current => current?.key === key && current.profile
      ? { ...current, profile: { ...current.profile, avatarUrl } } : current);
  }, [key]);
  const current = state?.key === key ? state : null;
  return { profile: current?.profile ?? null, loading: current === null, error: current?.error ?? null,
    retry, acceptUpdatedProfile, acceptAvatar };
}
