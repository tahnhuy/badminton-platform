export interface MatchHoldInput {
  ownerPlayerId: number;
  courtId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
}

export interface MatchHoldResult {
  bookingId: number;
  expiresAt: Date;
}

export interface MatchBookingPort {
  createMatchHold(input: MatchHoldInput): Promise<MatchHoldResult>;
  releaseMatchHold(input: { bookingId: number; reason: string }): Promise<void>;
}
