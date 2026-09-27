import { AppError } from '../shared/http/app-error';

export { AppError };

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
