export interface ApiErrorDetail {
  field?: string;
  code?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions extends RequestInit {
  skipCsrfRetry?: boolean;
}

export type AuthNotificationType = 'SESSION_INVALID' | 'PASSWORD_CHANGE_REQUIRED';
export type AuthErrorHandler = (type: AuthNotificationType) => void;

let authErrorHandler: AuthErrorHandler | null = null;

export function setAuthErrorHandler(handler: AuthErrorHandler | null): void {
  authErrorHandler = handler;
}

export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)csrf_token=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export async function httpClient<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  // Leave FormData Content-Type to the browser so its multipart boundary is preserved.
  // Other mutation requests retain the established JSON default.
  if (['POST', 'PUT', 'PATCH'].includes(method) && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach X-CSRF-Token on mutating requests if csrf_token cookie exists
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  // Include credentials (cookies) by default for same-origin API
  const fetchOptions: RequestInit = {
    ...options,
    method,
    headers,
    credentials: options.credentials ?? 'same-origin',
  };

  const response = await fetch(url, fetchOptions);

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  // Parse JSON response
  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorCode = data?.error?.code || 'UNKNOWN_ERROR';
    const errorMessage = data?.error?.message || response.statusText || 'An error occurred';
    const errorDetails = data?.error?.details || [];

    // 403 AUTH_CSRF_TOKEN_INVALID -> Call GET /api/v1/auth/me once to refresh csrf_token, then retry once
    if (
      response.status === 403 &&
      errorCode === 'AUTH_CSRF_TOKEN_INVALID' &&
      !options.skipCsrfRetry
    ) {
      try {
        await fetch('/api/v1/auth/me', { credentials: 'same-origin' });
        // Retry the original request once
        return await httpClient<T>(url, {
          ...options,
          skipCsrfRetry: true,
        });
      } catch {
        // Fall through to throw standard ApiError if retry fails
      }
    }

    // 401 AUTH_SESSION_INVALID or AUTH_SESSION_EXPIRED
    if (
      response.status === 401 &&
      (errorCode === 'AUTH_SESSION_INVALID' || errorCode === 'AUTH_SESSION_EXPIRED')
    ) {
      if (authErrorHandler) {
        authErrorHandler('SESSION_INVALID');
      }
    }

    // 403 AUTH_PASSWORD_CHANGE_REQUIRED
    if (response.status === 403 && errorCode === 'AUTH_PASSWORD_CHANGE_REQUIRED') {
      if (authErrorHandler) {
        authErrorHandler('PASSWORD_CHANGE_REQUIRED');
      }
    }

    throw new ApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  return data as T;
}
