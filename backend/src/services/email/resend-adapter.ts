import { Resend } from 'resend';
import type { EmailAdapter, EmailMessage, EmailSendResult } from './email-adapter';

export interface ResendAdapterOptions {
  apiKey: string;
  from: string;
}

export class ResendEmailAdapter implements EmailAdapter {
  private readonly client: Resend;

  constructor(private readonly options: ResendAdapterOptions) {
    this.client = new Resend(options.apiKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const response = await this.client.emails.send(
      {
        from: this.options.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      { idempotencyKey: message.idempotencyKey }
    );

    if (response.error) {
      throw new Error(`Resend rejected the email: ${response.error.name} (${response.error.message})`);
    }

    return { providerMessageId: response.data?.id ?? null };
  }
}
