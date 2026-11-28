import { financeIdentities } from '../../repositories/finance/FinanceIdentityRepository';

/** Resolve one page in a single query, preserving its ordering and membership. */
export async function attachFinanceIdentity<T, P extends string>(
  rows: T[], getId: (row: T) => number | null | undefined, prefix: P,
): Promise<Array<T & Record<`${P}Name` | `${P}Email`, string | null>>> {
  const identities = new Map((await financeIdentities(rows.map(row => getId(row) ?? 0))).map(user => [user.id, user]));
  return rows.map(row => {
    const user = identities.get(getId(row) ?? 0);
    return { ...row, [`${prefix}Name`]: user?.name ?? null, [`${prefix}Email`]: user?.email ?? null } as T & Record<`${P}Name` | `${P}Email`, string | null>;
  });
}
