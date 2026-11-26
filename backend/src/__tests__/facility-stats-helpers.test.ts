import { describe, expect, it } from 'vitest';
import { vietnamQuarterBounds } from '../shared/facility/quarter';
import { cityMatches, cityFilterPatterns, normalizeCityName } from '../shared/facility/city';

describe('Vietnam quarter bounds', () => {
  it('maps a mid-quarter instant to the correct UTC boundaries', () => {
    // 2026-11-15 10:00 Asia/Ho_Chi_Minh = 2026-11-15T03:00:00Z (Q4).
    const { start, end } = vietnamQuarterBounds(new Date('2026-11-15T03:00:00.000Z'));
    expect(start).toBe('2026-09-30T17:00:00.000Z');
    expect(end).toBe('2026-12-31T17:00:00.000Z');
  });

  it('uses the Vietnam calendar at a UTC year boundary', () => {
    // 2026-12-31T17:30:00Z is already 2027-01-01 00:30 in Vietnam (Q1 2027).
    const { start, end } = vietnamQuarterBounds(new Date('2026-12-31T17:30:00.000Z'));
    expect(start).toBe('2026-12-31T17:00:00.000Z');
    expect(end).toBe('2027-03-31T17:00:00.000Z');
  });

  it('handles the last instant of a quarter', () => {
    // 2026-06-30T16:59:59Z is 2026-06-30 23:59:59 in Vietnam (still Q2).
    const { start, end } = vietnamQuarterBounds(new Date('2026-06-30T16:59:59.000Z'));
    expect(start).toBe('2026-03-31T17:00:00.000Z');
    expect(end).toBe('2026-06-30T17:00:00.000Z');
  });
});

describe('City normalization', () => {
  it('normalizes common aliases', () => {
    expect(normalizeCityName('TP. Hồ Chí Minh')).toBe('Hồ Chí Minh');
    expect(normalizeCityName('HCM')).toBe('Hồ Chí Minh');
    expect(normalizeCityName('ha noi')).toBe('Hà Nội');
    expect(normalizeCityName('Đà Nẵng')).toBe('Đà Nẵng');
  });

  it('keeps unknown values instead of dropping them', () => {
    expect(normalizeCityName('Thành phố Mới')).toBe('Thành phố Mới');
    expect(normalizeCityName('')).toBe('');
  });

  it('matches aliases and builds stored-value patterns', () => {
    expect(cityMatches('TP. Hồ Chí Minh', 'Hồ Chí Minh')).toBe(true);
    expect(cityMatches('Hà Nội', 'Hồ Chí Minh')).toBe(false);
    expect(cityFilterPatterns('HCM')).toContain('%hồ chí minh%');
  });
});
