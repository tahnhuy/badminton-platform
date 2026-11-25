export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailSendResult {
  providerMessageId: string | null;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
