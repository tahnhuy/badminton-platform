import { z } from 'zod';
import { CONFIG_DOMAINS } from '../shared/config/config-registry';

export const listConfigsQuerySchema = z.object({
  domain: z.enum(CONFIG_DOMAINS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const configKeyParamSchema = z.object({
  configKey: z.string().min(1).max(120),
});

export const updateConfigBodySchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
});
