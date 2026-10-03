import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { logger } from '../shared/logging/logger';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    }));

    const fieldMessages = details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message));
    const formattedMessage =
      fieldMessages.length > 0 ? fieldMessages.join(', ') : 'Dữ liệu không hợp lệ';

    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: formattedMessage,
        details,
      },
    });
    return;
  }

  // Unexpected errors
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;

  logger.error('Unhandled internal server error', {
    message: errorMessage,
    stack: errorStack,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred',
      details: [],
    },
  });
};
