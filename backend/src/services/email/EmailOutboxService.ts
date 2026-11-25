import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { emailOutbox } from '../../db/schema/email';
import { authChallenges } from '../../db/schema/auth';
import { env } from '../../shared/config/env';
import { systemConfig } from '../../shared/config/system-config';
import { logger } from '../../shared/logging/logger';
import type { EmailAdapter } from './email-adapter';
import { fakeEmailAdapter } from './fake-adapter';
import { ResendEmailAdapter } from './resend-adapter';
import { renderEmail, type EmailTemplate, type EmailTemplateData } from './templates';

export interface EnqueueEmailInput {
  to: string;
  template: EmailTemplate;
  data: EmailTemplateData & { challengeId?: string };
  idempotencyKey: string;
}

const MAX_ERROR_LENGTH = 500;
/** A claimed row is retried after this lease if the worker died mid-send. */
const SENDING_LEASE_SECONDS = 300;

let adapterOverride: EmailAdapter | null = null;

/** Test hook: force an adapter (e.g. the fake adapter) without touching env. */
export function setEmailAdapter(adapter: EmailAdapter | null): void {
  adapterOverride = adapter;
}

function getAdapter(): EmailAdapter {
  if (adapterOverride) return adapterOverride;
  if (env.NODE_ENV === 'test') return fakeEmailAdapter;
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendEmailAdapter({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  return fakeEmailAdapter;
}

interface OutboxRow {
  id: number;
  idempotency_key: string;
  to_email: string;
  template: string;
  payload: (EmailTemplateData & { challengeId?: string }) | null;
  attempts: number;
}

export const emailOutboxService = {
  /** Inserts the email in the same transaction as the business change that needs it. */
  async enqueue(executor: { insert: typeof db.insert }, input: EnqueueEmailInput): Promise<void> {
    await executor
      .insert(emailOutbox)
      .values({
        idempotencyKey: input.idempotencyKey,
        toEmail: input.to.trim().toLowerCase(),
        template: input.template,
        payload: input.data,
      })
      .onConflictDoNothing({ target: emailOutbox.idempotencyKey });
  },

  /**
   * Claims due rows with SKIP LOCKED, sends them outside the claiming transaction
   * and records the result. Safe to run on several instances at once.
   */
  async processPending(limit = 50): Promise<{ sent: number; failed: number }> {
    const { maxAttempts } = await systemConfig.getEmailOutboxConfig();
    const claimed = await db.execute(sql`
      UPDATE email_outbox
      SET status = 'SENDING',
          next_attempt_at = now() + make_interval(secs => ${SENDING_LEASE_SECONDS})
      WHERE id IN (
        SELECT id FROM email_outbox
        WHERE status IN ('PENDING', 'FAILED', 'SENDING')
          AND attempts < ${maxAttempts}
          AND next_attempt_at <= now()
        ORDER BY id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, idempotency_key, to_email, template, payload, attempts;
    `);

    const rows = (claimed.rows ?? []) as unknown as OutboxRow[];
    if (rows.length === 0) return { sent: 0, failed: 0 };

    const adapter = getAdapter();
    // Tests and the fake dev adapter read the OTP back from the outbox; a real
    // provider run must not keep it at rest once it has been sent or abandoned.
    const scrubOtp = env.NODE_ENV !== 'test' && adapter !== fakeEmailAdapter;
    const scrubbedPayload = scrubOtp ? { payload: sql`${emailOutbox.payload} - 'otp'` } : {};
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const payload = row.payload ?? {};
      try {
        const rendered = renderEmail(row.template as EmailTemplate, payload);
        const result = await adapter.send({
          to: row.to_email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          idempotencyKey: row.idempotency_key,
        });

        await db
          .update(emailOutbox)
          .set({
            status: 'SENT',
            ...scrubbedPayload,
            providerMessageId: result.providerMessageId,
            lastError: null,
            sentAt: new Date(),
          })
          .where(eq(emailOutbox.id, row.id));

        if (payload.challengeId) {
          await db
            .update(authChallenges)
            .set({ sendStatus: 'SENT', updatedAt: new Date() })
            .where(eq(authChallenges.id, payload.challengeId));
        }
        sent++;
      } catch (error) {
        failed++;
        const attempts = row.attempts + 1;
        const exhausted = attempts >= maxAttempts;
        const message = error instanceof Error ? error.message : String(error);
        await db
          .update(emailOutbox)
          .set({
            status: exhausted ? 'FAILED' : 'PENDING',
            ...(exhausted ? scrubbedPayload : {}),
            attempts,
            lastError: message.slice(0, MAX_ERROR_LENGTH),
            nextAttemptAt: new Date(Date.now() + Math.min(attempts * attempts * 30_000, 15 * 60_000)),
          })
          .where(eq(emailOutbox.id, row.id));

        if (payload.challengeId) {
          await db
            .update(authChallenges)
            .set({ sendStatus: 'FAILED', updatedAt: new Date() })
            .where(eq(authChallenges.id, payload.challengeId));
        }
        logger.warn('Email outbox send failed', { outboxId: row.id, attempts, exhausted });
      }
    }

    return { sent, failed };
  },

  /** Best-effort prompt send after a request; the periodic job remains the retry owner. */
  processSoon(): void {
    if (env.NODE_ENV === 'test') return;
    setTimeout(() => {
      void this.processPending().catch(error => {
        logger.error('Email outbox background send failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }, 0);
  },
};
