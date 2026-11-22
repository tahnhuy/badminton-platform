import { useQuery } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, RotateCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/shared/api/http-client';
import { shouldRetryRequest } from '@/app/query-client';
import { authApi } from '../auth-api';
import { SURVEY_UNAVAILABLE, SURVEY_UNAVAILABLE_MESSAGE } from './register-errors';
import { RegisterShell } from './register-shell';
import { RegisterWizardView } from './register-wizard';
import { skillSurveyKey } from './register-queries';

export function RegisterPage() {
  const survey = useQuery({
    queryKey: skillSurveyKey,
    queryFn: ({ signal }) => authApi.getSkillSurvey(signal).then(response => response.data),
    // Kept for the whole visit: a version change is reported by the server on submit.
    staleTime: Infinity,
    retry: (count, error) => !(error instanceof ApiError && error.code === SURVEY_UNAVAILABLE) && shouldRetryRequest(count, error),
  });
  return <RegisterShell note="Khảo sát trình độ ban đầu" className="pb-24 lg:pb-0">
    <main aria-label="Đăng ký người chơi">
      {survey.data
        ? <RegisterWizardView survey={survey.data} />
        : <div className="mx-auto max-w-110 rounded-panel border border-border bg-card px-6 py-10 text-center shadow-panel sm:px-10">
          <h1 className="text-2xl font-extrabold tracking-tight">Đăng ký người chơi</h1>
          {survey.isPending
            ? <p role="status" className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />Đang tải khảo sát trình độ…</p>
            : survey.error instanceof ApiError && survey.error.code === SURVEY_UNAVAILABLE
              ? <Alert variant="warning" className="mt-5 text-left">{SURVEY_UNAVAILABLE_MESSAGE}</Alert>
              : <>
                <Alert variant="destructive" className="mt-5 flex items-start gap-3 text-left"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />Không thể tải khảo sát trình độ. Vui lòng thử lại.</Alert>
                <Button type="button" variant="outline" className="mt-4" onClick={() => survey.refetch()}><RotateCw aria-hidden="true" />Thử lại</Button>
              </>}
        </div>}
    </main>
  </RegisterShell>;
}
