import { z } from 'zod';
export const playerPhone = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}, z.string().max(40).regex(/^[+\d ()-]+$/)
  .transform(value => value.replace(/[ ()-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Enter 7–15 digits, optionally prefixed with +')).nullable());
export const playerContactBody = z.object({ phone: playerPhone }).strict();
