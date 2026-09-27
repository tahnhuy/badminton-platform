import { Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

export interface ParsedCookies {
  sid?: string;
  csrf_token?: string;
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function parseCookies(cookieHeader?: string): ParsedCookies {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  const result: ParsedCookies = {};
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let val = trimmed.slice(equalIndex + 1).trim();

    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = val.slice(1, -1);
    }

    try {
      val = decodeURIComponent(val);
    } catch {
      // Keep raw value if URI malformed
    }

    if (key === 'sid') {
      result.sid = val;
    } else if (key === 'csrf_token') {
      result.csrf_token = val;
    }
  }

  return result;
}

export interface SetAuthCookiesParams {
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}

export function setAuthCookies(res: Response, params: SetAuthCookiesParams): void {
  const maxAgeSeconds = Math.max(0, Math.floor((params.expiresAt.getTime() - Date.now()) / 1000));
  const maxAgeMs = maxAgeSeconds * 1000;

  res.cookie('sid', params.sessionToken, {
    httpOnly: true,
    secure: env.isCookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });

  res.cookie('csrf_token', params.csrfToken, {
    httpOnly: false,
    secure: env.isCookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function setCsrfCookie(res: Response, csrfToken: string, expiresAt: Date): void {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const maxAgeMs = maxAgeSeconds * 1000;

  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: env.isCookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('sid', {
    path: '/',
    httpOnly: true,
    secure: env.isCookieSecure,
    sameSite: 'lax',
  });

  res.clearCookie('csrf_token', {
    path: '/',
    httpOnly: false,
    secure: env.isCookieSecure,
    sameSite: 'lax',
  });
}

