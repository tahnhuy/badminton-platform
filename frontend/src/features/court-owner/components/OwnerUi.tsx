import type { ReactNode } from 'react';
import { labels } from '../types/labels';
export function Status({ value }: { value: string }) { return <span className={`owner-status owner-status-${value}`}>{labels[value] ?? value}</span>; }
export function Feedback({ error, success }: { error?: string; success?: string }) { return <>{error && <p className="owner-error" role="alert">{error}</p>}{success && <p className="owner-note" role="status">{success}</p>}</>; }
export function ResourceState({ loading, error, retry, children }: { loading: boolean; error?: string; retry: () => void; children?: ReactNode }) { return <>{loading ? <p role="status">Đang tải…</p> : children}{error && <div role="alert" className="owner-error">{error} <button onClick={retry}>Thử lại</button></div>}</>; }
export function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) { return <nav aria-label="Phân trang" className="owner-actions"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} / {Math.max(1, pages)}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button></nav>; }
