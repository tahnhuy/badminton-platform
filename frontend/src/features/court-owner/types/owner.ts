export interface Meta { page: number; limit: number; total: number; totalPages: number }
export interface Review { id: number; kind: string; status: string; rejectionReason: string | null; submittedAt: string; reviewedAt: string | null; submittedValues: Record<string, unknown> }
export interface Court {
  id: number; name: string; description: string | null; status: string;
  surfaceType: string | null; surfaceBrand: string | null; surfaceModel: string | null;
  surfaceThicknessMm: string | null; condition: string | null; conditionNote: string | null;
  profileVersion: number; hasActiveMaintenanceBlock?: boolean;
}
export interface Facility {
  id: number; name: string; description: string | null; phone: string; address: string; ward: string | null;
  district: string; city: string; openingTime: string; closingTime: string;
  status: string; updatedAt: string; courtCount?: number; courts?: Court[]; latestOnboardingReview?: Review | null; pendingAddressReview?: Review | null;
}
export interface StandardDefinition { code: string; name: string; requiresExpiry: boolean }
export interface StandardClaim { id: number; standardCode: string; standardName: string; status: string; surfaceBrand: string; surfaceModel: string; issuer: string; referenceNo: string; issuedAt: string | null; expiresAt: string | null; rejectionReason: string | null; reviewedAt: string | null; createdAt: string; evidenceMediaIds: number[] }
export interface Pricing { id: number; startTime: string; endTime: string; pricePerHour: number; validFrom: string; validTo: string | null }
export interface PlayerContact { fullName: string | null; email: string; phone: string | null }
export interface Slot { startTime: string; endTime: string; state: string; unavailableReasons?: string[]; pricePerHour?: number; bookingId?: number; bookingStatus?: string; bookingKind?: string; player?: PlayerContact; blockId?: number; reason?: string }
export interface Schedule { facilityId: number; date: string; courts: { courtId: number; courtName: string; status: string; slots: Slot[] }[] }
export interface OwnerBooking { id: number; bookingCode: string; facilityId: number; courtId: number; bookingDate: string; startTime: string; endTime: string; status: string; totalAmount: number; unitPrice: number; bookingKind: string; refundStatus: string; player?: PlayerContact; tournamentId?: number; matchId?: number; cancellationReason?: string | null; cancelledAt?: string | null; pricingDetails?: { startTime: string; endTime: string; price: string; amount: string }[] }
