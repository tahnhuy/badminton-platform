/** Consistent identity display for financial users, owners and operators. */
export function FinanceUser({ id, name, email, empty = '—' }: {
  id?: number | string | null; name?: string | null; email?: string | null; empty?: string;
}) {
  const displayName = name?.trim();
  const displayEmail = email?.trim();
  return <div className="min-w-0 break-words">
    <p className="font-semibold">{displayName || displayEmail || (id ? `Người dùng #${id}` : empty)}</p>
    {displayName && displayEmail && <p className="text-xs text-muted-foreground">{displayEmail}</p>}
  </div>;
}
