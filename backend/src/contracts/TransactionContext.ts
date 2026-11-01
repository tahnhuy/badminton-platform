import type { db } from '../db';

/**
 * The caller's open database transaction, passed through cross-module contracts
 * (Matchmaking Tech Design §24.2: "all accept the caller's transaction").
 * A provider receiving it must not open, commit or roll back its own transaction.
 */
export type TransactionContext = Parameters<Parameters<typeof db.transaction>[0]>[0];
