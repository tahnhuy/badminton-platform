export interface ErrorDetail {
  field?: string;
  code: string;
  message?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: ErrorDetail[] = []) {
    super(400, 'VALIDATION_FAILED', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'AUTH_SESSION_INVALID') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', code: string = 'AUTH_FORBIDDEN_ROLE') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict error', code: string = 'CONFLICT') {
    super(409, code, message);
  }
}
