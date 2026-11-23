import { useEffect, useState } from 'react';
import { profileApi } from './profile-api';

/**
 * Whether to offer "Xem kết quả khảo sát" on the own profile (AUTH-32): only when
 * the Player has a registration survey result. Errors hide the link.
 */
export function useHasOwnSkillSurvey(enabled: boolean): boolean {
  const [hasResult, setHasResult] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    profileApi.hasOwnSkillSurvey(controller.signal)
      .then(setHasResult)
      .catch(() => setHasResult(false));
    return () => controller.abort();
  }, [enabled]);
  return enabled && hasResult;
}
