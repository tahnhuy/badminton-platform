import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, RotateCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/shared/api/http-client';
import { RequireAuth } from '@/shared/auth/require-auth';
import { authApi } from '../auth-api';
import { useAuth } from '../use-auth';
import { readRegisterResultState, type RegisterResultState } from './register-result-state';
import { RegisterShell } from './register-shell';
import { ResultView } from './result-view';
import { ownSkillSurveyKey } from './register-queries';

/**
 * `/register/result` (outside PlayerLayout). Shows the result handed over by registration
 * without a session (registration does not sign in; the only action leads to `/sign-in`).
 * A reload or a direct visit is PLAYER-only and loads `GET /players/me/skill-survey`
 * (404 → `/profile`).
 */
export function RegisterResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Take the registration result once, then drop it from history so a reload reads the saved result.
  const [handed] = useState<RegisterResultState | null>(() => readRegisterResultState(location.state));
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  if (handed) return <ResultView result={handed.result} fullName={handed.fullName} fresh signInEmail={handed.email} />;
  return <RequireAuth allowedRoles={['PLAYER']}><SavedResult /></RequireAuth>;
}

function SavedResult() {
  const { user } = useAuth();
  const saved = useQuery({
    queryKey: ownSkillSurveyKey(user?.id),
    queryFn: ({ signal }) => authApi.getOwnSkillSurvey(signal).then(response => response.data),
    gcTime: 0, // private data: not kept after the page unmounts
  });

  if (saved.error instanceof ApiError && saved.error.statusCode === 404) return <Navigate to="/profile" replace />;
  if (saved.data) return <ResultView result={saved.data} fullName="" fresh={false} />;
  return <RegisterShell signInLink={false}>
    <div className="mx-auto max-w-110 rounded-panel border border-border bg-card px-6 py-10 text-center shadow-panel sm:px-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Kết quả khảo sát trình độ</h1>
      {saved.isPending
        ? <p role="status" className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />Đang tải kết quả…</p>
        : <>
          <Alert variant="destructive" className="mt-5 flex items-start gap-3 text-left"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />Không thể tải kết quả khảo sát. Vui lòng thử lại.</Alert>
          <Button type="button" variant="outline" className="mt-4" onClick={() => saved.refetch()}><RotateCw aria-hidden="true" />Thử lại</Button>
        </>}
    </div>
  </RegisterShell>;
}
