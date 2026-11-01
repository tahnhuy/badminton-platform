import { describe, it, expect } from 'vitest';
import { requestScheduleFields } from '../services/matchmaking/matchmaking-time.util';

describe('request schedule response compatibility', () => {
  it('projects a Social interval with NULL legacy fields into Vietnamese date/time', () => {
    expect(requestScheduleFields({ startAt: new Date('2026-11-03T11:00:00Z'), durationMinutes: 90, preferredDate: null, preferredStartTime: null, preferredEndTime: null })).toEqual({ preferredDate: '2026-11-03', preferredStartTime: '18:00:00', preferredEndTime: '19:30:00' });
  });
  it('uses the Vietnam calendar day and handles an end after midnight', () => {
    expect(requestScheduleFields({ startAt: new Date('2026-11-03T16:30:00Z'), durationMinutes: 120, preferredDate: null, preferredStartTime: null, preferredEndTime: null })).toEqual({ preferredDate: '2026-11-03', preferredStartTime: '23:30:00', preferredEndTime: '01:30:00' });
    expect(requestScheduleFields({ startAt: new Date('2026-11-03T19:00:00Z'), durationMinutes: 90, preferredDate: null, preferredStartTime: null, preferredEndTime: null }).preferredDate).toBe('2026-11-04');
  });
  it('preserves the preferred window on legacy requests', () => {
    expect(requestScheduleFields({ startAt: new Date('2026-11-03T11:00:00Z'), durationMinutes: 90, preferredDate: '2026-11-03', preferredStartTime: '17:00:00', preferredEndTime: '21:00:00' })).toEqual({ preferredDate: '2026-11-03', preferredStartTime: '17:00:00', preferredEndTime: '21:00:00' });
  });
});
