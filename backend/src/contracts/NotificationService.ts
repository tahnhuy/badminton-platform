export interface NotificationMessage {
  type: string;
  title: string;
  content: string;
}

export interface NotificationService {
  notify(userIds: number[], message: NotificationMessage): Promise<void>;
}
