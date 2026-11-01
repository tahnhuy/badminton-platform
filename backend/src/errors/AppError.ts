export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: unknown[];
  public retryAfterSeconds?: number;

  constructor(code: string, statusCode: number, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ErrorDetail {
  field?: string;
  code: string;
  message?: string;
}

export class ValidationError extends AppError {
  constructor(message: string, details: unknown[] = []) {
    super('VALIDATION_FAILED', 400, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'AUTH_SESSION_INVALID') {
    super(code, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', code: string = 'AUTH_FORBIDDEN_ROLE') {
    super(code, 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(code, 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict error', code: string = 'CONFLICT') {
    super(code, 409, message);
  }
}

/**
 * Raised inside a transaction when a snapshot-derived lock set changed while waiting
 * (Matchmaking Tech Design §24.7.1 rule 3). Nothing has been written yet; the owner of the
 * transaction rolls back and retries with a new snapshot. Never reaches the client.
 */
export class TransactionRetryError extends Error {
  constructor(message: string = 'Lock set changed; retry the transaction') {
    super(message);
    this.name = 'TransactionRetryError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
