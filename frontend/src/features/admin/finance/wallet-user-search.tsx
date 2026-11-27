import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { adminUserService } from '../services/adminUserService';
import type { User } from '../types/user';
import { financeLabel } from './finance-labels';
import { cn } from '@/shared/utils/cn';

function nameOf(user: User): string {
  return user.profile && 'fullName' in user.profile ? user.profile.fullName
    : user.profile && 'businessName' in user.profile ? user.profile.businessName : user.email;
}
interface Props { onSelect: (id: string) => void; onClear: () => void; onRefresh: () => void; selectedId: string; actions?: ReactNode }
function useWalletUserSearch({ onSelect, onClear, selectedId }: Props) {
  const [query, setQuery] = useState(selectedId ? `#${selectedId}` : '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ query: string; users: User[]; error: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const term = query.trim();
  const eligible = term.length >= 2 && !selectedId;
  const users = result?.query === term ? result.users : [];
  const pending = eligible && result?.query !== term;

  useEffect(() => {
    if (!eligible) return;
    let current = true;
    const timer = window.setTimeout(() => {
      void adminUserService.fetchUsers({ search: term, page: 1, limit: 8 }).then(response => {
        if (current) setResult({ query: term, users: response.data, error: false });
      }).catch(() => {
        if (current) setResult({ query: term, users: [], error: true });
      });
    }, 300);
    return () => { current = false; window.clearTimeout(timer); };
  }, [term, eligible, retry]);

  const choose = (user: User) => {
    setQuery(nameOf(user) === user.email ? user.email : `${nameOf(user)} · ${user.email}`); setOpen(false); setActive(-1); onSelect(String(user.id));
    inputRef.current?.focus();
  };
  const edit = (value: string) => {
    setQuery(value); setActive(-1); setResult(null); onClear(); setOpen(true);
  };
  const numericId = /^\d+$/.test(term) && Number.isSafeInteger(Number(term)) && Number(term) > 0;
  const status = walletSearchStatus(pending, result, term, eligible, users);

  return { query, open, setOpen, active, setActive, retrySearch: () => { setResult(null); setRetry(value => value + 1); }, result,
    inputRef, listId, term, eligible, users, pending, choose, edit, numericId, status, selectedId };
}
type SearchState = ReturnType<typeof useWalletUserSearch>;

function walletSearchStatus(
  pending: boolean,
  result: { query: string; users: User[]; error: boolean; } | null,
  term: string,
  eligible: boolean,
  users: User[],


) {
  return pending ? 'Đang tìm tài khoản…' : result?.query === term && result.error
    ? 'Không thể tải gợi ý. Vui lòng thử lại.' : eligible && !users.length ? 'Không tìm thấy tài khoản phù hợp.'
      : eligible ? `${users.length} tài khoản gợi ý. Dùng phím mũi tên để chọn.` : 'Nhập ít nhất 2 ký tự để tìm theo tên, email hoặc số điện thoại; có thể tra cứu bằng mã người dùng.';
}

function WalletSearchInput({ state }: { state: SearchState }) {
  const { query, open, setOpen, active, setActive, users, inputRef, listId, selectedId, term, edit, pending } = state;
  return <PopoverAnchor asChild>
          <div className="relative col-span-full min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-1 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={listId + '-input'} ref={inputRef} role="combobox" aria-autocomplete="list" aria-haspopup="listbox"
              aria-expanded={open && !selectedId} aria-busy={pending} aria-controls={open && !selectedId ? listId : undefined}
              aria-activedescendant={open && active >= 0 && users[active] ? `${listId}-${users[active].id}` : undefined}
              aria-describedby={listId + '-status'} autoComplete="off" placeholder="Tên, email, số điện thoại hoặc mã người dùng"
              value={query} className="pl-9 pr-11" onChange={event => edit(event.target.value)} onFocus={() => { if (!selectedId && term) setOpen(true); }}
              onKeyDown={event => {
                if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault(); setOpen(true);
                  const next = users.length ? (event.key === 'ArrowDown' ? (active + 1) % users.length : (active <= 0 ? users.length - 1 : active - 1)) : -1;
                  setActive(next);
                  if (next >= 0) document.getElementById(`${listId}-${users[next].id}`)?.scrollIntoView({ block: 'nearest' });
                }
              }} />
            {query && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-11" aria-label="Xóa tìm kiếm người dùng" onClick={() => { edit(''); inputRef.current?.focus(); }}><X aria-hidden="true" /></Button>}
          </div>
  </PopoverAnchor>;
}

function WalletSearchOptions({ state }: { state: SearchState }) {
  const { users, active, listId, inputRef, term, result, status, choose, setActive, retrySearch } = state;
  return <PopoverContent role="listbox" aria-label="Người dùng phù hợp" id={listId} align="start"
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-1"
          onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
          onInteractOutside={event => {
            if (event.target instanceof Node && inputRef.current?.closest('form')?.contains(event.target)) event.preventDefault();
          }}>
          {users.map((user, index) => <div role="option" aria-selected={active === index} id={`${listId}-${user.id}`} key={user.id}
            className={cn('cursor-pointer rounded-lg px-3 py-3 text-sm hover:bg-accent', active === index && 'bg-accent')}
            onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(user)}>
            <p className="font-semibold [overflow-wrap:anywhere]">{nameOf(user)}</p>
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{user.email} · #{user.id} · {financeLabel(user.role)}</p>
          </div>)}
          {!users.length && <div className="p-3 text-sm text-muted-foreground">{status}
            {result?.query === term && result.error && <Button type="button" variant="ghost" className="mt-2 w-full" onClick={retrySearch}>Thử lại</Button>}
          </div>}
        </PopoverContent>;
}

export function WalletUserSearch(props: Props) {
  const state = useWalletUserSearch(props);
  const { open, setOpen, active, users, choose, selectedId, numericId, term, eligible, listId, status } = state;
  const { onSelect, onRefresh } = props;
  return <form className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-72" aria-label="Tra cứu ví người dùng" onSubmit={event => {
    event.preventDefault();
    if (open && active >= 0 && users[active]) choose(users[active]);
    else if (selectedId) onRefresh();
    else if (numericId) { onSelect(String(Number(term))); setOpen(false); }
    else if (eligible) setOpen(true);
  }}>
    <label htmlFor={listId + '-input'} className="text-xs font-semibold text-muted-foreground">Tìm người dùng</label>
    <div className="grid min-w-0 grid-cols-3 gap-2 sm:flex">
      <Popover open={open && !selectedId} onOpenChange={setOpen}>
        <WalletSearchInput state={state} />
        <WalletSearchOptions state={state} />
      </Popover>
      <Button type="submit" variant="outline" disabled={!selectedId && !numericId && !(open && active >= 0)}>Xem ví</Button>
      {props.actions}
    </div>
    <p id={listId + '-status'} role="status" className="text-xs text-muted-foreground">{selectedId ? `Đã chọn người dùng #${selectedId}.` : status}</p>
  </form>;
}
