import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, RefreshCw, Search, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { httpClient } from '@/shared/api/http-client';
import { cn } from '@/shared/utils/cn';
import { AdminHeader } from '@/features/admin/components/AdminHeader';
import { AdminMain } from '@/features/admin/components/AdminMain';
import { AdminSidebar } from '@/features/admin/components/AdminSidebar';
import { errorMessage, feeLabel, formatDateTime, matchTypeLabel, STATUS_LABEL } from '../format';
import type { Page, Tournament, TournamentStatus } from '../types';
import { StatusPill } from '../components/shared';

const TERMINAL: TournamentStatus[] = ['COMPLETED', 'CANCELLED'];

/** `/admin/tournaments` — monitor every tournament; Admin can only cancel (Tech Design §3.5; TRN-12). */
export function AdminTournamentsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  // Deep link (notification / global search): show only that tournament until cleared.
  const highlight = Number(params.get('tournamentId')) || null;
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Tournament | null>(null);
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  useEffect(() => { const id = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(id); }, [search]);

  const list = useQuery({
    queryKey: ['admin', 'tournaments', highlight, status, q, page],
    queryFn: () => httpClient<Page<Tournament>>(highlight ? `/api/v1/admin/tournaments?id=${highlight}`
      : `/api/v1/admin/tournaments?page=${page}&limit=20${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: keepPreviousData,
  });
  const cancel = useMutation({
    mutationFn: ({ id, why }: { id: number; why: string }) => httpClient(`/api/v1/admin/tournaments/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: why }) }),
    onSuccess: async () => {
      toast.success('Đã huỷ giải và hoàn lệ phí cho người tham gia.');
      setTarget(null); setReason('');
      await client.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
    onError: error => toast.error(errorMessage(error)),
  });
  const recalc = useMutation({
    mutationFn: () => httpClient<{ data: { changed: number } }>('/api/v1/admin/tournaments/skill-ratings/recalculate', { method: 'POST' }),
    onSuccess: result => { toast.success(`Đã tính lại phong độ — ${result.data.changed} người chơi đổi trình độ.`); setRecalcOpen(false); },
    onError: error => toast.error(errorMessage(error)),
  });
  const rows = list.data?.data ?? [];

  return <div className="flex min-h-svh bg-background font-sans text-foreground">
    <AdminSidebar isCollapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)} isMobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
    <AdminMain isCollapsed={collapsed}>
      <AdminHeader isCollapsed={collapsed} onToggleMobileSidebar={() => setMobileOpen(true)} />
      <main id="admin-main-content" tabIndex={-1} className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight"><Trophy aria-hidden="true" className="size-6 text-primary" />Quản lý giải đấu</h1>
            <p className="mt-1 text-sm text-muted-foreground">Theo dõi mọi giải (kể cả bản nháp). Admin chỉ có quyền huỷ giải — lệ phí được hoàn 100% cho người tham gia.</p>
          </div>
          <Button type="button" variant="outline" className="h-11" onClick={() => setRecalcOpen(true)}><RefreshCw aria-hidden="true" />Tính lại phong độ</Button>
        </div>
        {highlight && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-brand-light px-4 py-3 text-sm">
          <span>Đang xem giải #{highlight} từ liên kết.</span>
          <Button type="button" variant="ghost" className="h-9" onClick={() => setParams({}, { replace: true })}>Xem tất cả giải</Button>
        </div>}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label htmlFor="admin-trn-search">Tìm theo tên</Label>
            <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="admin-trn-search" type="search" className="h-11 pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên giải" /></div>
          </div>
          <div className="flex w-56 flex-col gap-1.5">
            <Label htmlFor="admin-trn-status">Trạng thái</Label>
            <Select id="admin-trn-status" value={status} onChange={value => { setStatus(value); setPage(1); }}
              options={[{ value: '', label: 'Tất cả' }, ...(Object.keys(STATUS_LABEL) as TournamentStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s] }))]} />
          </div>
        </div>
        {list.isPending ? <div className="grid gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          : list.isError ? <EmptyState icon={Trophy} title="Không tải được danh sách" description="Kiểm tra kết nối rồi thử lại." action={{ label: 'Thử lại', onClick: () => list.refetch() }} role="alert" />
            : rows.length === 0 ? <EmptyState icon={Trophy} title="Không có giải nào" description="Đổi bộ lọc để xem giải khác." />
              : <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full min-w-200 text-sm">
                  <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-4 py-3">Giải</th><th className="px-4 py-3">Organizer</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Người tham gia</th><th className="px-4 py-3">Lệ phí</th><th className="px-4 py-3">Bắt đầu</th><th className="px-4 py-3 text-right">Thao tác</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(t => <tr key={t.id} className={cn('border-t border-border', highlight === t.id && 'bg-brand-light')}>
                      <td className="px-4 py-3"><p className="font-semibold">{t.name}</p><p className="text-xs text-muted-foreground">#{t.id} · {matchTypeLabel(t.matchType)}</p></td>
                      <td className="px-4 py-3">{t.organizer?.fullName ?? '—'}</td>
                      <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                      <td className="px-4 py-3 tabular-nums">{t.confirmedCount}/{t.participantLimit}</td>
                      <td className="px-4 py-3">{feeLabel(t.entryFee)}</td>
                      <td className="px-4 py-3">{formatDateTime(t.tournamentStart)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!TERMINAL.includes(t.status) && <Button type="button" variant="danger-soft" className="h-9" onClick={() => setTarget(t)}><Ban aria-hidden="true" />Huỷ giải</Button>}
                        </div>
                      </td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
        {(list.data?.meta.totalPages ?? 1) > 1 && <Pagination page={page} totalPages={list.data!.meta.totalPages} onPageChange={setPage} />}
      </main>
    </AdminMain>
    {recalcOpen && <ConfirmDialog title="Tính lại phong độ toàn hệ thống?" confirmLabel="Tính lại" busyLabel="Đang tính…" busy={recalc.isPending}
      description={<p>Phát lại toàn bộ lịch sử giải với tham số <code>SKILL_RATING_*</code> hiện tại. Người chơi đổi trình độ sẽ nhận thông báo. Dùng sau khi đổi tham số phong độ.</p>}
      onCancel={() => setRecalcOpen(false)} onConfirm={() => recalc.mutate()} />}
    {target && <ConfirmDialog title={`Huỷ ${target.name}?`} tone="danger" confirmLabel="Huỷ giải và hoàn tiền" busyLabel="Đang huỷ…" busy={cancel.isPending}
      description={<p>{target.confirmedCount > 0 ? <>{target.confirmedCount} đăng ký được <b>hoàn 100% lệ phí</b>. </> : null}Organizer và người tham gia nhận thông báo kèm lý do. Không thể hoàn tác.</p>}
      onCancel={() => { setTarget(null); setReason(''); }} onConfirm={() => { if (reason.trim()) cancel.mutate({ id: target.id, why: reason.trim() }); }}>
      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="admin-cancel-reason">Lý do (bắt buộc)</Label>
        <Input id="admin-cancel-reason" className="h-11" maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: Vi phạm quy định nền tảng" />
      </div>
    </ConfirmDialog>}
  </div>;
}
