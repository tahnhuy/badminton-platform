import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

export interface ValidationSchema {
  query?: ZodTypeAny;
  body?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schema: ValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.query) {
        const parsed = await schema.query.parseAsync(req.query);
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          configurable: true,
        });
      }
      if (schema.params) {
        const parsed = await schema.params.parseAsync(req.params);
        Object.defineProperty(req, 'params', {
          value: parsed,
          writable: true,
          configurable: true,
        });
      }
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
