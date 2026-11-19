import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { labels } from '../types/labels';

const tones: Record<string, string> = {
  ACTIVE: 'bg-success-bg text-success', FREE: 'bg-success-bg text-success', APPROVED: 'bg-success-bg text-success',
  REJECTED: 'bg-danger-bg text-danger', SUSPENDED: 'bg-danger-bg text-danger', CANCELLED: 'bg-danger-bg text-danger',
  PENDING: 'bg-caution-bg text-caution', PENDING_APPROVAL: 'bg-caution-bg text-caution', PENDING_PAYMENT: 'bg-caution-bg text-caution',
};
export function Status({ value }: { value: string }) { return <span className={cn('inline-flex w-fit whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', tones[value] ?? 'bg-muted text-muted-foreground')}>{labels[value] ?? value}</span>; }
export function Feedback({ error, success }: { error?: string; success?: string }) { return <>{error && <p className="rounded-lg bg-danger-bg p-4 text-sm leading-6 text-danger" role="alert">{error}</p>}{success && <p className="rounded-lg bg-success-bg p-4 text-sm leading-6 text-success" role="status">{success}</p>}</>; }
export function ResourceState({ loading, error, retry, children }: { loading: boolean; error?: string; retry: () => void; children?: ReactNode }) { return <>{loading ? <div role="status" className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">Đang tải…</p><Skeleton className="h-32 rounded-2xl" /></div> : children}{error && <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-danger-bg p-4 text-sm text-danger">{error} <Button type="button" variant="outline" className="h-11" onClick={retry}>Thử lại</Button></div>}</>; }
export function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) { return <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-3 text-sm"><Button variant="outline" className="h-11" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button><span>Trang {page} / {Math.max(1, pages)}</span><Button variant="outline" className="h-11" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</Button></nav>; }
