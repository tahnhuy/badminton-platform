export interface CourtSummary {
  id: number;
  facilityId: number;
  name: string;
  status: string;
}

export interface CourtService {
  getCourtById(courtId: number): Promise<CourtSummary | null>;
  listCourtsByIds(courtIds: number[]): Promise<CourtSummary[]>;
}
