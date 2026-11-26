import type { EmailAdapter, EmailMessage, EmailSendResult } from './email-adapter';

/**
 * Test/dev adapter. Nothing leaves the process; tests can inspect the captured
 * messages, and a failure can be simulated without a provider.
 */
export const fakeEmailAdapter = {
  sent: [] as EmailMessage[],
  failNext: false,

  reset(): void {
    this.sent = [];
    this.failNext = false;
  },

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Simulated email provider failure');
    }
    this.sent.push(message);
    return { providerMessageId: `fake-${this.sent.length}` };
  },
} satisfies EmailAdapter & { sent: EmailMessage[]; failNext: boolean; reset(): void };
