import { logger } from '../../shared/logging/logger';

export type BookingDomainEventType =
  | 'BookingConfirmed'
  | 'BookingCancelled'
  | 'BookingExpired'
  | 'BookingCompleted';

export interface BookingDomainEvent {
  type: BookingDomainEventType;
  bookingId: number;
  reason?: string;
}

type BookingEventListener = (event: BookingDomainEvent) => void;

/**
 * In-process seam for booking domain events. The database remains the source of
 * truth; these events are a best-effort trigger for notification/refund
 * consumers (NotificationModule, PaymentModule refund worker). Listeners are
 * isolated: a throwing listener is logged and must never affect the state
 * transition or other listeners. Consumers that must be durable should also
 * reconcile from persisted booking state.
 */
class BookingEventBus {
  private readonly listeners = new Set<BookingEventListener>();

  publish(event: BookingDomainEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Booking event listener failed', {
          type: event.type,
          bookingId: event.bookingId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  subscribe(listener: BookingEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const bookingEvents = new BookingEventBus();
