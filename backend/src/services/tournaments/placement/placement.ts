/**
 * Placements from a resolved single-elimination bracket (Tech Design §7.6; TRN-16, reused by
 * TRN-14/TRN-18). Pure: no database access.
 *
 * Final winner CHAMPION, final loser RUNNER_UP, semi-final losers SEMI_FINAL, quarter-final
 * losers QUARTER_FINAL, earlier losers ROUND_OF_n (n = bracket slots in that round, BYEs
 * included). Walkover and retired losers lose in that round; both sides of a cancelled match
 * (resolution NONE) leave the tournament in that round.
 */

export type Placement = 'CHAMPION' | 'RUNNER_UP' | 'SEMI_FINAL' | 'QUARTER_FINAL' | `ROUND_OF_${number}`;

export interface PlacementMatch {
  roundIndex: number;
  registration1Id: number | null;
  registration2Id: number | null;
  winnerRegistrationId: number | null;
  resolution: string;
}

export function roundPlacement(roundIndex: number, totalRounds: number): Placement {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'RUNNER_UP';
  if (fromEnd === 1) return 'SEMI_FINAL';
  if (fromEnd === 2) return 'QUARTER_FINAL';
  return `ROUND_OF_${2 ** (totalRounds - roundIndex)}`;
}

/** Order for display and points: lower is better. */
export function placementOrder(placement: Placement): number {
  if (placement === 'CHAMPION') return 1;
  if (placement === 'RUNNER_UP') return 2;
  if (placement === 'SEMI_FINAL') return 3;
  if (placement === 'QUARTER_FINAL') return 5;
  return Number(placement.slice('ROUND_OF_'.length)) / 2 + 1;
}

export function computePlacements(matches: PlacementMatch[], totalRounds: number): Map<number, Placement> {
  const result = new Map<number, Placement>();
  const ordered = [...matches].sort((a, b) => a.roundIndex - b.roundIndex);
  for (const m of ordered) {
    if (m.resolution === 'UNRESOLVED') continue;
    const sides = [m.registration1Id, m.registration2Id].filter((id): id is number => id !== null);
    const eliminated = m.resolution === 'NONE' || m.winnerRegistrationId === null ? sides : sides.filter(id => id !== m.winnerRegistrationId);
    for (const id of eliminated) if (!result.has(id)) result.set(id, roundPlacement(m.roundIndex, totalRounds));
    if (m.roundIndex === totalRounds - 1 && m.winnerRegistrationId !== null && m.resolution !== 'NONE') {
      result.set(m.winnerRegistrationId, 'CHAMPION');
    }
  }
  return result;
}

export const isTopFour = (placement: Placement | undefined) =>
  placement === 'CHAMPION' || placement === 'RUNNER_UP' || placement === 'SEMI_FINAL';
