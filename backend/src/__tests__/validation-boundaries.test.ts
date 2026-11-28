import { describe, expect, it } from 'vitest';
import { courtSearchQuerySchema, dateStringSchema, timeStringSchema } from '../validation/booking';
import { matchmakingDateStringSchema, matchmakingTimeStringSchema } from '../validation/matchmaking';
import { payoutRequestBodySchema } from '../validation/wallet';
import { registerBodySchema } from '../validation/tournaments';

// Booking/Matchmaking dates must agree at actual calendar and day boundaries.
// Pure schemas: run without database cleanup in vitest.unit.config.ts.
describe('Cross-domain calendar and financial request boundaries', () => {
  it('accepts leap days only in leap years in both booking and matchmaking', () => {
    for (const schema of [dateStringSchema, matchmakingDateStringSchema]) {
      for (const value of ['2028-02-29', '2000-02-29', '2026-12-31']) expect(schema.safeParse(value).success).toBe(true);
      for (const value of ['2026-02-29', '2100-02-29', '2026-04-31', '2026-00-10', '2026-13-01']) expect(schema.safeParse(value).success).toBe(false);
    }
  });
  it('accepts day endpoints but rejects overflow hours and minutes in both domains', () => {
    for (const schema of [timeStringSchema, matchmakingTimeStringSchema]) {
      for (const value of ['00:00', '23:59']) expect(schema.safeParse(value).success).toBe(true);
      for (const value of ['24:00', '23:60', '-1:00', '9:00']) expect(schema.safeParse(value).success).toBe(false);
    }
  });
  it('requires a complete ordered time window and its date for court search', () => {
    expect(courtSearchQuerySchema.safeParse({date:'2028-02-29', startTime:'00:00', endTime:'23:59'}).success).toBe(true);
    for (const value of [
      {date:'2028-02-29', startTime:'10:00'}, {startTime:'10:00',endTime:'11:00'},
      {date:'2028-02-29', startTime:'10:00',endTime:'10:00'},
      {date:'2028-02-29', startTime:'11:00',endTime:'10:00'},
    ]) expect(courtSearchQuerySchema.safeParse(value).success).toBe(false);
  });
  it('requires exactly six PIN digits and an idempotency UUID for payout requests', () => {
    const valid = {amount:'100000',bankAccountId:1,withdrawalPin:'028461',clientRequestId:'b768285b-9e51-4b16-9384-e9957be0e1c1'};
    expect(payoutRequestBodySchema.safeParse(valid).success).toBe(true);
    for (const withdrawalPin of ['12345','1234567','abcdef','１２３４５６']) expect(payoutRequestBodySchema.safeParse({...valid,withdrawalPin}).success).toBe(false);
    expect(payoutRequestBodySchema.safeParse({...valid,clientRequestId:'replay'}).success).toBe(false);
    expect(payoutRequestBodySchema.safeParse({...valid,bankAccountId:0}).success).toBe(false);
  });
  it('rejects unauthorized extra fields and invalid team identities during registration', () => {
    expect(registerBodySchema.safeParse({}).success).toBe(true);
    expect(registerBodySchema.safeParse({teamId:1}).success).toBe(true);
    for (const value of [{teamId:0},{teamId:1.5},{teamId:1,status:'CONFIRMED'}]) expect(registerBodySchema.safeParse(value).success).toBe(false);
  });
});
