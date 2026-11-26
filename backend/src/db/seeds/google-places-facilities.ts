import * as fs from 'fs';
import * as path from 'path';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../index';
import { users, courtOwnerProfiles, facilities, courts, courtPricings } from '../schema';
import { hashPassword } from '../../utils/password';

const DATASET_PATH = path.join(__dirname, '..', 'data', 'badminton-places.json');
const IMPORT_OWNER_EMAIL = 'imported.venues@smashpro.vn';
const IMPORT_OWNER_NAME = 'SmashPro Imported Venues';
const IMPORT_OWNER_PHONE = '0900000000';
const DEFAULT_PASSWORD = 'Password@123';
const COURTS_PER_FACILITY = 4;
const PRICING_VALID_FROM = '2025-01-01';

interface RawOpeningHour {
  day?: string;
  hours?: string;
}

interface RawPlace {
  placeId?: string;
  cid?: string;
  title?: string;
  address?: string;
  neighborhood?: string;
  state?: string;
  searchString?: string;
  phone?: string;
  phoneUnformatted?: string;
  ownerDescription?: string | null;
  openingHours?: RawOpeningHour[];
}

export interface ImportedFacility {
  placeId: string | null;
  name: string;
  district: string;
  ward: string;
  city: string;
  phone: string;
  address: string;
  openingTime: string;
  closingTime: string;
  description: string | null;
}

export interface GooglePlacesSeedReport {
  total: number;
  valid: number;
  imported: number;
  skipped: number;
  legacyMatched: number;
  invalid: { title: string; reason: string }[];
}

export interface GooglePlacesSeedOptions {
  /** Report what would happen without writing facilities, courts or pricings. */
  dryRun?: boolean;
}

function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim();
}

export function normalizePhone(raw: string | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('84') && digits.length > 9) return `0${digits.slice(2)}`;
  return digits;
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function dominantPair(hours: RawOpeningHour[]): { open: number; close: number } | null {
  const counts = new Map<string, number>();
  for (const entry of hours) {
    const match = /^(\d{1,2}:\d{2})\s*to\s*(\d{1,2}:\d{2})$/.exec(normalizeText(entry.hours));
    if (!match) continue;
    const key = `${match[1]}-${match[2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const [dominant] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [openRaw, closeRaw] = dominant[0].split('-');
  const open = parseClock(openRaw);
  const close = parseClock(closeRaw);
  if (open === null || close === null) return null;
  return { open, close };
}

export function resolveOpeningHours(
  hours: RawOpeningHour[]
): { openingTime: string; closingTime: string } | null {
  if (!hours || hours.length === 0) return null;
  if (hours.some((entry) => normalizeText(entry.hours) === 'Mở cửa cả ngày')) {
    return { openingTime: '00:00:00', closingTime: '23:59:59' };
  }

  const pair = dominantPair(hours);
  if (!pair) return null;
  if (pair.open >= pair.close) {
    return { openingTime: formatClock(pair.open), closingTime: '23:59:59' };
  }
  return { openingTime: formatClock(pair.open), closingTime: formatClock(pair.close) };
}

export function deriveCity(place: RawPlace): string {
  const state = normalizeText(place.state);
  const segments = state
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length > 0) return segments[segments.length - 1];

  const search = normalizeText(place.searchString);
  if (/TP\.?\s*HCM|Hồ Chí Minh/i.test(search)) return 'Hồ Chí Minh';
  const cityMatch = /Thành phố\s+([^,]+)/.exec(search);
  if (cityMatch) return cityMatch[1].trim();
  return 'Khác';
}

export function deriveDistrict(place: RawPlace): string {
  const search = normalizeText(place.searchString);
  const cityMatch = /Thành phố\s+([^,]+)/.exec(search);
  if (cityMatch) return cityMatch[1].trim();
  const districtMatch = /Quận\s+([^,]+)/.exec(search);
  if (districtMatch) return `Quận ${districtMatch[1].trim()}`;
  const state = normalizeText(place.state).split(',')[0].trim();
  return state || 'Khác';
}

export function validatePlace(
  place: RawPlace
): { ok: true; value: ImportedFacility } | { ok: false; reason: string } {
  const name = normalizeText(place.title);
  if (!name) return { ok: false, reason: 'missing title' };

  const hours = resolveOpeningHours(place.openingHours ?? []);
  if (!hours) return { ok: false, reason: 'missing or unparsable opening hours' };

  const district = deriveDistrict(place);
  return {
    ok: true,
    value: {
      placeId: normalizeText(place.placeId) || null,
      name,
      district,
      ward: normalizeText(place.neighborhood) || district,
      city: deriveCity(place),
      phone: normalizePhone(place.phoneUnformatted ?? place.phone),
      address: normalizeText(place.address) || `${name}, ${district}, TP. Hồ Chí Minh`,
      openingTime: hours.openingTime,
      closingTime: hours.closingTime,
      description: normalizeText(place.ownerDescription) || null,
    },
  };
}

export function buildPricingRows(
  openingTime: string,
  closingTime: string
): { startTime: string; endTime: string; price: string }[] {
  const open = toMinutes(openingTime);
  const close = toMinutes(closingTime);
  const rows: { startTime: string; endTime: string; price: string }[] = [];

  const dayStart = Math.max(open, 6 * 60);
  const dayEnd = Math.min(close, 17 * 60);
  if (dayStart < dayEnd) {
    rows.push({ startTime: formatClock(dayStart), endTime: formatClock(dayEnd), price: '80000' });
  }

  const peakStart = Math.max(open, 17 * 60);
  const peakEnd = Math.min(close, 22 * 60);
  if (peakStart < peakEnd) {
    rows.push({ startTime: formatClock(peakStart), endTime: formatClock(peakEnd), price: '120000' });
  }

  if (rows.length === 0 && open < close) {
    rows.push({ startTime: formatClock(open), endTime: formatClock(close), price: '90000' });
  }
  return rows;
}

async function ensureImportOwner(): Promise<number> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, IMPORT_OWNER_EMAIL))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const [owner] = await db
    .insert(users)
    .values({
      email: IMPORT_OWNER_EMAIL,
      passwordHash: await hashPassword(DEFAULT_PASSWORD),
      role: 'COURT_OWNER',
      status: 'ACTIVE',
    })
    .returning();

  await db.insert(courtOwnerProfiles).values({
    userId: owner.id,
    businessName: IMPORT_OWNER_NAME,
    phone: IMPORT_OWNER_PHONE,
  });
  return owner.id;
}

async function createFacilityWithInventory(ownerId: number, place: ImportedFacility): Promise<void> {
  const [facility] = await db
    .insert(facilities)
    .values({
      ownerId,
      name: place.name,
      description: place.description,
      phone: place.phone || IMPORT_OWNER_PHONE,
      status: 'ACTIVE',
      address: place.address,
      ward: place.ward,
      district: place.district,
      city: place.city,
      openingTime: place.openingTime,
      closingTime: place.closingTime,
      dataSource: 'GOOGLE_PLACES_IMPORT',
      sourceRef: place.placeId,
      deletedAt: null,
    })
    .returning();

  const pricingRows = buildPricingRows(place.openingTime, place.closingTime);
  for (let index = 1; index <= COURTS_PER_FACILITY; index += 1) {
    const [court] = await db
      .insert(courts)
      .values({
        facilityId: facility.id,
        name: `Sân ${String(index).padStart(2, '0')}`,
        status: 'ACTIVE',
        dataSource: 'GOOGLE_PLACES_IMPORT',
        sourceRef: place.placeId,
        deletedAt: null,
      })
      .returning();

    if (pricingRows.length > 0) {
      await db.insert(courtPricings).values(
        pricingRows.map((row) => ({
          courtId: court.id,
          startTime: row.startTime,
          endTime: row.endTime,
          price: row.price,
          validFrom: PRICING_VALID_FROM,
        }))
      );
    }
  }
}

export async function findExisting(place: ImportedFacility) {
  if (place.placeId) {
    const [bySource] = await db
      .select({ id: facilities.id, confirmedAt: facilities.confirmedAt })
      .from(facilities)
      .where(and(eq(facilities.sourceRef, place.placeId), eq(facilities.dataSource, 'GOOGLE_PLACES_IMPORT')))
      .limit(1);
    if (bySource) return { row: bySource, legacy: false };
  }

  // Legacy rows created before source_ref existed: match a normalized name and
  // the same normalized address, then attach the place id without overwriting content.
  const legacyRows = await db
    .select({ id: facilities.id, address: facilities.address, name: facilities.name, confirmedAt: facilities.confirmedAt, sourceRef: facilities.sourceRef })
    .from(facilities)
    .where(sql`lower(regexp_replace(trim(${facilities.name}), '[[:space:]]+', ' ', 'g')) = ${place.name.trim().replace(/\s+/g, ' ').toLowerCase()}`);
  const addressMatches = legacyRows.filter(row => row.address.trim().replace(/\s+/g, ' ').toLowerCase() === place.address.trim().replace(/\s+/g, ' ').toLowerCase());
  if (addressMatches.length > 1) throw new Error(`Ambiguous imported facility: ${place.name}`);
  const match = addressMatches[0];
  return match ? { row: match, legacy: match.sourceRef === null } : null;
}

export async function seedGooglePlacesFacilities(options: GooglePlacesSeedOptions = {}): Promise<GooglePlacesSeedReport> {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Google Places dataset not found at ${DATASET_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8')) as RawPlace[];

  const invalid: { title: string; reason: string }[] = [];
  const valid: ImportedFacility[] = [];
  partitionValidPlaces(raw, valid, invalid);

  const ownerId = options.dryRun ? 0 : await ensureImportOwner();
  let imported = 0;
  let skipped = 0;
  let legacyMatched = 0;
  for (const place of valid) {
    const existing = await findExisting(place);
    if (existing) {
      skipped += 1;
      if (existing.legacy && place.placeId && existing.row.confirmedAt === null) {
        legacyMatched += 1;
        if (!options.dryRun) {
          await db.update(facilities).set({ sourceRef: place.placeId }).where(and(eq(facilities.id, existing.row.id), isNull(facilities.confirmedAt), isNull(facilities.sourceRef), eq(facilities.dataSource, 'GOOGLE_PLACES_IMPORT')));
        }
      }
      continue;
    }
    if (!options.dryRun) await createFacilityWithInventory(ownerId, place);
    imported += 1;
  }

  return { total: raw.length, valid: valid.length, imported, skipped, legacyMatched, invalid };
}

function partitionValidPlaces(raw: RawPlace[], valid: ImportedFacility[], invalid: { title: string; reason: string; }[]) {
  for (const place of raw) {
    const result = validatePlace(place);
    if (result.ok) {
      valid.push(result.value);
    } else {
      invalid.push({ title: normalizeText(place.title) || '(untitled)', reason: result.reason });
    }
  }
}
