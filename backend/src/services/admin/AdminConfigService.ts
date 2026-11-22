import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { systemConfigs } from '../../db/schema/config';
import { systemConfigAudit } from '../../db/schema/config-audit';
import { AppError, NotFoundError } from '../../errors/AppError';
import { notifyAdmins } from '../notifications/admin-notifications';
import {
  clearConfigCache,
  configDefinitions,
  ConfigDefinition,
  ConfigDomain,
  ConfigKey,
  defaultConfigValueString,
  getConfigDefinition,
  isConfigEditable,
  parseConfigValue,
  validateConfigCrossKeyRules,
  validateConfigValue,
} from '../../shared/config/config-registry';

export interface ConfigItem {
  configKey: ConfigKey;
  configValue: string;
  valueType: 'boolean' | 'integer' | 'enum';
  domain: ConfigDomain;
  description: string;
  documentedDefault: string;
  usingDefault: boolean;
  updatedAt: Date | null;
  updatedBy: number | null;
  editable: boolean;
  allowedValues: string[] | null;
  min: number | null;
  max: number | null;
}

export interface ListConfigsInput {
  domain?: ConfigDomain;
  page: number;
  limit: number;
}

type StoredRow = {
  configKey: string;
  configValue: string;
  updatedBy: number | null;
  updatedAt: Date;
};

function toItem(key: ConfigKey, row: StoredRow | undefined): ConfigItem {
  const definition = configDefinitions[key] as ConfigDefinition;
  const parsed = row ? parseConfigValue(definition, row.configValue) : undefined;
  const usingDefault = parsed === undefined;
  return {
    configKey: key,
    configValue: String(usingDefault ? definition.defaultValue : parsed),
    valueType: definition.type,
    domain: definition.domain,
    description: definition.description,
    documentedDefault: defaultConfigValueString(key),
    usingDefault,
    updatedAt: usingDefault ? null : row!.updatedAt,
    updatedBy: usingDefault ? null : row!.updatedBy,
    editable: isConfigEditable(definition),
    allowedValues: definition.type === 'enum' ? [...definition.allowedValues] : null,
    min: definition.type === 'integer' ? definition.min : null,
    max: definition.type === 'integer' ? definition.max ?? null : null,
  };
}

export class AdminConfigService {
  async listConfigs(input: ListConfigsInput): Promise<{
    data: ConfigItem[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const keys = (Object.keys(configDefinitions) as ConfigKey[])
      .filter(key => !input.domain || configDefinitions[key].domain === input.domain)
      .sort();

    const total = keys.length;
    const start = (input.page - 1) * input.limit;
    const pageKeys = keys.slice(start, start + input.limit);
    const rows = pageKeys.length > 0
      ? await db.select({
        configKey: systemConfigs.configKey,
        configValue: systemConfigs.configValue,
        updatedBy: systemConfigs.updatedBy,
        updatedAt: systemConfigs.updatedAt,
      }).from(systemConfigs).where(inArray(systemConfigs.configKey, pageKeys))
      : [];
    const byKey = new Map(rows.map(row => [row.configKey, row as StoredRow]));

    return {
      data: pageKeys.map(key => toItem(key, byKey.get(key))),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
      },
    };
  }

  async getConfig(key: string): Promise<ConfigItem> {
    const configKey = this.requireKey(key);
    const [row] = await db.select({
      configKey: systemConfigs.configKey,
      configValue: systemConfigs.configValue,
      updatedBy: systemConfigs.updatedBy,
      updatedAt: systemConfigs.updatedAt,
    }).from(systemConfigs).where(eq(systemConfigs.configKey, key)).limit(1);
    return toItem(configKey, row as StoredRow | undefined);
  }

  async updateConfig(key: string, input: unknown, adminId: number): Promise<ConfigItem> {
    const configKey = this.requireKey(key);
    const definition = configDefinitions[configKey];

    if (!isConfigEditable(definition)) {
      throw new AppError('CONFIG_KEY_READ_ONLY', 409, `${configKey} is read-only`);
    }

    const validation = validateConfigValue(configKey, input);
    if (!validation.ok) {
      throw new AppError('CONFIG_VALUE_INVALID', 400, validation.message, [
        { field: configKey, code: validation.code },
      ]);
    }

    const candidate = validation.value;
    const candidateValue = parseConfigValue(definition, candidate) ?? definition.defaultValue;
    const rows = await db.select({
      configKey: systemConfigs.configKey,
      configValue: systemConfigs.configValue,
      updatedBy: systemConfigs.updatedBy,
      updatedAt: systemConfigs.updatedAt,
    }).from(systemConfigs);
    const currentRow = rows.find(row => row.configKey === configKey) as StoredRow | undefined;
    const currentValue = currentRow ? parseConfigValue(definition, currentRow.configValue) : definition.defaultValue;

    if (String(currentValue) === String(candidateValue)) {
      return toItem(configKey, currentRow);
    }

    const effective: Record<string, boolean | number | string> = {};
    for (const row of rows) {
      const rowDefinition = getConfigDefinition(row.configKey);
      if (!rowDefinition) continue;
      effective[row.configKey] = parseConfigValue(rowDefinition, row.configValue) ?? rowDefinition.defaultValue;
    }
    effective[configKey] = candidateValue;

    const violations = validateConfigCrossKeyRules(effective);
    if (violations.length > 0) {
      throw new AppError('CONFIG_VALUE_INVALID', 400, `Cross-key rule violated: ${violations[0].rule}`, [
        { field: violations[0].keys.join(','), code: 'CROSS_KEY_RULE' },
      ]);
    }

    const now = new Date();
    await db.transaction(async tx => {
      await tx.insert(systemConfigs).values({
        configKey,
        configValue: candidate,
        description: definition.description,
        updatedBy: adminId,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: candidate, updatedBy: adminId, updatedAt: now },
      });
      const [audit] = await tx.insert(systemConfigAudit).values({
        configKey,
        oldValue: currentRow?.configValue ?? null,
        newValue: candidate,
        changedBy: adminId,
        changedAt: now,
      }).returning({ id: systemConfigAudit.id });
      await notifyAdmins(tx, {
        type: 'ADMIN_CONFIG_CHANGED',
        title: 'Cấu hình hệ thống vừa thay đổi',
        content: `${configKey}: ${currentRow?.configValue ?? String(definition.defaultValue)} → ${candidate}`,
        resource: { type: 'ADMIN_CONFIG_AUDIT', id: audit.id },
        dedupKey: `admin-config:${audit.id}`,
        excludeUserIds: [adminId],
      });
    });

    clearConfigCache();
    return this.getConfig(configKey);
  }

  private requireKey(key: string): ConfigKey {
    if (!getConfigDefinition(key)) {
      throw new NotFoundError(`Unknown configuration key: ${key}`, 'CONFIG_KEY_NOT_FOUND');
    }
    return key as ConfigKey;
  }
}

export const adminConfigService = new AdminConfigService();
