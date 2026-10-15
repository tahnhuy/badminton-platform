import { describe, it, expect, vi } from 'vitest';
import { SkillAdjustmentService, targetRankFromAverage } from '../services/ratings/SkillAdjustmentService';
import type { SkillAdjustmentRepository } from '../repositories/ratings/SkillAdjustmentRepository';

const now = new Date('2026-10-15T12:00:00Z');
const config = { enabled: true, minRatings: 5, threshold: 1, cooldownDays: 14 };
function fixture(previous: Date | null) {
  const repo = {
    findPlayerProfileForUpdate: vi.fn().mockResolvedValue({ userId: 1, skillLevelId: 1 }),
    findRecentSkillRatings: vi.fn().mockResolvedValue([5, 5, 5, 5, 5]),
    findSkillLevelById: vi.fn().mockResolvedValue({ id: 1, rank: 1 }),
    findLastAdjustment: vi.fn().mockResolvedValue(previous ? { createdAt: previous } : null),
    findSkillLevelByRank: vi.fn().mockResolvedValue({ id: 2, rank: 2 }),
    updatePlayerSkillLevel: vi.fn().mockResolvedValue(undefined),
    insertAdjustment: vi.fn().mockResolvedValue({ id: 1 }),
  };
  return { repo, service: new SkillAdjustmentService(repo as unknown as SkillAdjustmentRepository) };
}

describe('Skill adjustment review boundaries', () => {
  it('does not round into the next band', () => {
    expect(targetRankFromAverage(2.495)).toBe(2);
    expect(targetRankFromAverage(4.999)).toBe(5);
  });
  it('allows exactly the cooldown boundary and records evaluation time', async () => {
    const { service, repo } = fixture(new Date(now.getTime() - 14 * 86400000));
    expect(await service.evaluateTarget(1, {}, config, now)).toEqual({ adjusted: true });
    expect(repo.insertAdjustment).toHaveBeenCalledWith(expect.objectContaining({ createdAt: now, previousSkillLevelId: 1, newSkillLevelId: 2 }), expect.anything());
  });
  it('skips one millisecond before cooldown expiry', async () => {
    const { service, repo } = fixture(new Date(now.getTime() - 14 * 86400000 + 1));
    expect(await service.evaluateTarget(1, {}, config, now)).toEqual({ adjusted: false });
    expect(repo.insertAdjustment).not.toHaveBeenCalled();
  });
  it('permits a distinct new evaluation with cooldown zero', async () => {
    const { service } = fixture(now);
    expect(await service.evaluateTarget(1, {}, { ...config, cooldownDays: 0 }, now)).toEqual({ adjusted: true });
  });
  it('skips when rank gap is below threshold or the window is incomplete', async () => {
    const { service, repo } = fixture(null);
    expect(await service.evaluateTarget(1, {}, { ...config, threshold: 6 }, now)).toEqual({ adjusted: false });
    repo.findRecentSkillRatings.mockResolvedValue([5, 5, 5, 5]);
    expect(await service.evaluateTarget(1, {}, config, now)).toEqual({ adjusted: false });
    expect(repo.insertAdjustment).not.toHaveBeenCalled();
  });
});
