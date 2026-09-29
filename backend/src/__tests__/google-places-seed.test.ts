import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  resolveOpeningHours,
  deriveCity,
  deriveDistrict,
  validatePlace,
  buildPricingRows,
} from '../db/seeds/google-places-facilities';

describe('Google Places seed validation', () => {
  it('normalizes Vietnamese phone numbers', () => {
    expect(normalizePhone('+84 862 857 171')).toBe('0862857171');
    expect(normalizePhone('+84862857171')).toBe('0862857171');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });

  it('resolves normal, all-day, midnight and cross-midnight hours', () => {
    expect(resolveOpeningHours([{ hours: '05:00 to 23:00' }])).toEqual({
      openingTime: '05:00:00',
      closingTime: '23:00:00',
    });
    expect(resolveOpeningHours([{ hours: 'Mở cửa cả ngày' }])).toEqual({
      openingTime: '00:00:00',
      closingTime: '23:59:59',
    });
    expect(resolveOpeningHours([{ hours: '05:00 to 00:00' }])).toEqual({
      openingTime: '05:00:00',
      closingTime: '23:59:59',
    });
    expect(resolveOpeningHours([{ hours: '05:00 to 02:00' }])).toEqual({
      openingTime: '05:00:00',
      closingTime: '23:59:59',
    });
    expect(resolveOpeningHours([])).toBeNull();
  });

  it('picks the dominant weekly opening pair', () => {
    expect(
      resolveOpeningHours([
        { day: 'Thứ Hai', hours: '05:00 to 22:00' },
        { day: 'Thứ Ba', hours: '05:00 to 22:00' },
        { day: 'Thứ Tư', hours: '06:00 to 21:00' },
      ])
    ).toEqual({ openingTime: '05:00:00', closingTime: '22:00:00' });
  });

  it('derives the city from the state instead of hardcoding one', () => {
    expect(deriveCity({ state: 'Gò Vấp, Hồ Chí Minh' })).toBe('Hồ Chí Minh');
    expect(deriveCity({ state: 'Hà Nội' })).toBe('Hà Nội');
    expect(deriveCity({ searchString: 'sân cầu lông Quận 7, TP.HCM' })).toBe('Hồ Chí Minh');
  });

  it('derives the district from the search string', () => {
    expect(deriveDistrict({ searchString: 'sân cầu lông Quận Gò Vấp, TP.HCM' })).toBe('Quận Gò Vấp');
    expect(deriveDistrict({ searchString: 'sân cầu lông Thành phố Thủ Đức, TP.HCM' })).toBe('Thủ Đức');
    expect(deriveDistrict({ state: 'Gò Vấp, Hồ Chí Minh' })).toBe('Gò Vấp');
  });

  it('validates a complete place into a facility record', () => {
    const result = validatePlace({
      title: 'Sân Cầu Lông Demo',
      address: '1 Đường Test, Quận 7',
      neighborhood: 'Tân Thuận Đông',
      searchString: 'sân cầu lông Quận 7, TP.HCM',
      phoneUnformatted: '+84901234567',
      location: { lat: 10.74, lng: 106.72 },
      openingHours: [{ hours: '05:00 to 23:00' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Sân Cầu Lông Demo');
      expect(result.value.district).toBe('Quận 7');
      expect(result.value.phone).toBe('0901234567');
      expect(result.value.city).toBe('Hồ Chí Minh');
      expect(result.value.closingTime).toBe('23:00:00');
    }
  });

  it('rejects invalid places', () => {
    expect(validatePlace({ title: 'No coords', openingHours: [{ hours: '05:00 to 22:00' }] }).ok).toBe(false);
    expect(
      validatePlace({ title: 'No hours', location: { lat: 10.7, lng: 106.7 } }).ok
    ).toBe(false);
    expect(
      validatePlace({
        title: 'Abroad',
        location: { lat: 1.3, lng: 103.8 },
        openingHours: [{ hours: '05:00 to 22:00' }],
      }).ok
    ).toBe(false);
  });

  it('builds pricing rows clipped to the venue hours', () => {
    expect(buildPricingRows('05:00:00', '23:00:00')).toEqual([
      { startTime: '06:00:00', endTime: '17:00:00', price: '80000' },
      { startTime: '17:00:00', endTime: '22:00:00', price: '120000' },
    ]);
    expect(buildPricingRows('08:00:00', '20:00:00')).toEqual([
      { startTime: '08:00:00', endTime: '17:00:00', price: '80000' },
      { startTime: '17:00:00', endTime: '20:00:00', price: '120000' },
    ]);
    expect(buildPricingRows('05:00:00', '05:30:00')).toEqual([
      { startTime: '05:00:00', endTime: '05:30:00', price: '90000' },
    ]);
  });
});
