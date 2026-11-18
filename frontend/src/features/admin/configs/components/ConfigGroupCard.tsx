import React, { useState } from 'react';
import { getConfigUiMeta } from '../config-ui-meta';
import { naturalApiError, validateConfigDraft } from '../config-validation';
import type { ConfigGroupDefinition } from '../config-groups';
import type { ConfigItem } from '../types/config';

export interface ConfigUpdate {
  item: ConfigItem;
  value: string | number | boolean;
}

interface ConfigGroupCardProps {
  group: ConfigGroupDefinition;
  items: ConfigItem[];
  onSave: (updates: ConfigUpdate[], label: string) => Promise<void>;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function latestUpdated(items: ConfigItem[]): string {
  const latest = items
    .filter(item => item.updatedAt)
    .sort((left, right) => new Date(right.updatedAt!).getTime() - new Date(left.updatedAt!).getTime())[0];
  if (!latest) return 'Chưa có thay đổi';
  return latest.updatedBy
    ? `${formatDate(latest.updatedAt)} · Admin #${latest.updatedBy}`
    : formatDate(latest.updatedAt);
}

export const ConfigGroupCard: React.FC<ConfigGroupCardProps> = ({ group, items, onSave }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(items.map(item => [item.configKey, item.configValue])),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const fields = group.keys
    .map(key => items.find(item => item.configKey === key))
    .filter((item): item is ConfigItem => Boolean(item));
  const byKey = new Map(fields.map(item => [item.configKey, item]));
  const modeItem = group.kind === 'mode-number' ? byKey.get(group.keys[0]) : undefined;
  const toggleItem = group.kind === 'toggle-number' || group.kind === 'skill' ? byKey.get(group.keys[0]) : undefined;
  const numberItems = fields.filter(item => item.valueType === 'integer');

  const isVisible = (item: ConfigItem): boolean => {
    if (group.kind === 'mode-number') {
      const mode = drafts[group.keys[0]];
      return item.configKey !== group.keys[0] ? mode === 'LIMITED' : true;
    }
    if (group.kind === 'toggle-number') {
      const enabled = drafts[group.keys[0]];
      return item.configKey !== group.keys[0] ? enabled === 'true' : true;
    }
    return true;
  };

  const dirtyFields = fields.filter(item => item.editable && isVisible(item) && drafts[item.configKey] !== item.configValue);
  const dirty = dirtyFields.length > 0;

  const fieldErrors = new Map<string, string>();
  for (const item of numberItems) {
    if (!isVisible(item)) continue;
    const message = validateConfigDraft(item, drafts[item.configKey]);
    if (message) fieldErrors.set(item.configKey, message);
  }

  let crossError: string | null = null;
  if (group.kind === 'pair' && fields.length >= 2) {
    const lowerItem = fields[0];
    const upperItem = fields[1];
    if (!fieldErrors.has(lowerItem.configKey) && !fieldErrors.has(upperItem.configKey)) {
      const lower = Number(drafts[lowerItem.configKey]);
      const upper = Number(drafts[upperItem.configKey]);
      if (lower > upper) {
        crossError = `${getConfigUiMeta(lowerItem).label} không được lớn hơn ${getConfigUiMeta(upperItem).label.toLowerCase()}.`;
      }
    }
  }

  const hasValidationErrors = fieldErrors.size > 0 || Boolean(crossError);

  const parseValue = (item: ConfigItem, raw: string): string | number | boolean => {
    if (item.valueType === 'boolean') return raw === 'true';
    if (item.valueType === 'integer') return Number(raw);
    return raw;
  };

  const orderedUpdates = (): ConfigUpdate[] => {
    const updates = dirtyFields.map(item => ({ item, value: parseValue(item, drafts[item.configKey]) }));

    if (group.kind === 'pair' && updates.length === 2) {
      const lowerItem = fields[0];
      const upperItem = fields[1];
      const currentUpper = Number(upperItem.configValue);
      const newLower = Number(drafts[lowerItem.configKey]);
      const lowerUpdate = updates.find(update => update.item.configKey === lowerItem.configKey)!;
      const upperUpdate = updates.find(update => update.item.configKey === upperItem.configKey)!;
      // Keep the intermediate state valid: if the new lower bound exceeds the
      // current upper bound, persist the upper bound first.
      return newLower <= currentUpper
        ? [lowerUpdate, upperUpdate]
        : [upperUpdate, lowerUpdate];
    }

    return updates;
  };

  const updateDraft = (key: string, value: string) => {
    setDrafts(current => ({ ...current, [key]: value }));
    setError('');
  };

  const apply = async () => {
    if (hasValidationErrors) return;

    setIsSaving(true);
    setError('');
    try {
      await onSave(orderedUpdates(), group.title);
    } catch (err) {
      setError(naturalApiError(err, 'Không thể lưu cấu hình.'));
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = () => {
    setDrafts(Object.fromEntries(items.map(item => [item.configKey, item.configValue])));
    setError('');
  };

  const renderNumber = (item: ConfigItem) => {
    const meta = getConfigUiMeta(item);
    if (!isVisible(item)) return null;
    const fieldError = fieldErrors.get(item.configKey);
    return (
      <div className="config-field" key={item.configKey}>
        <div className="config-field-header">
          <span className="config-field-label">{meta.label}</span>
          {item.usingDefault && <span className="config-badge default">Mặc định</span>}
          {!item.editable && <span className="config-badge readonly">Chỉ đọc</span>}
        </div>
        <div className="config-number-row">
          <div className="config-number-field">
            <input
              type="number"
              value={drafts[item.configKey]}
              min={item.min ?? undefined}
              max={item.max ?? undefined}
              disabled={!item.editable || isSaving}
              onChange={event => updateDraft(item.configKey, event.target.value)}
              aria-label={meta.label}
            />
            {meta.unit && <span className="config-unit">{meta.unit}</span>}
          </div>
          <span className="config-bounds">
            {item.min ?? '—'} đến {item.max ?? 'không giới hạn'}
          </span>
          {fieldError && <div className="config-warning" role="alert">{fieldError}</div>}
        </div>
      </div>
    );
  };

  const renderBoolean = (item: ConfigItem, showLabel: boolean) => {
    const meta = getConfigUiMeta(item);
    const labels = meta.booleanLabels ?? { true: 'Bật', false: 'Tắt' };
    return (
      <div className="config-field" key={item.configKey}>
        {showLabel && (
          <div className="config-field-header">
            <span className="config-field-label">{meta.label}</span>
            {item.usingDefault && <span className="config-badge default">Mặc định</span>}
            {!item.editable && <span className="config-badge readonly">Chỉ đọc</span>}
          </div>
        )}
        <div className={`config-radio-group inline ${item.editable ? '' : 'read-only'}`} role="radiogroup" aria-label={meta.label}>
          <label className={`config-radio ${drafts[item.configKey] === 'true' ? 'selected' : ''}`}>
            <input
              type="radio"
              name={item.configKey}
              checked={drafts[item.configKey] === 'true'}
              disabled={!item.editable || isSaving}
              onChange={() => updateDraft(item.configKey, 'true')}
            />
            <span>{labels.true}</span>
          </label>
          <label className={`config-radio ${drafts[item.configKey] === 'false' ? 'selected' : ''}`}>
            <input
              type="radio"
              name={item.configKey}
              checked={drafts[item.configKey] === 'false'}
              disabled={!item.editable || isSaving}
              onChange={() => updateDraft(item.configKey, 'false')}
            />
            <span>{labels.false}</span>
          </label>
        </div>
      </div>
    );
  };

  const renderEnum = (item: ConfigItem) => {
    const meta = getConfigUiMeta(item);
    if (item !== modeItem) return null;
    return (
      <div className="config-field" key={item.configKey}>
        <div className="config-radio-group inline" role="radiogroup" aria-label={meta.label}>
          {(item.allowedValues ?? []).map(value => (
            <label key={value} className={`config-radio ${drafts[item.configKey] === value ? 'selected' : ''}`}>
              <input
                type="radio"
                name={item.configKey}
                checked={drafts[item.configKey] === value}
                disabled={!item.editable || isSaving}
                onChange={() => updateDraft(item.configKey, value)}
              />
              <span>{meta.optionLabels?.[value] ?? value}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <article className="config-card config-group-card">
      <header className="config-card-header">
        <div>
          <h3>{group.title}</h3>
        </div>
        <div className="config-card-badges">
          {fields.some(item => item.usingDefault) && <span className="config-badge default">Đang dùng mặc định</span>}
        </div>
      </header>

      <p className="config-card-description group-description">{group.description}</p>

      <div className="config-group-fields">
        {group.kind === 'mode-number' && modeItem && (
          <>
            {renderEnum(modeItem)}
            {numberItems.map(renderNumber)}
          </>
        )}

        {group.kind === 'toggle-number' && toggleItem && (
          <>
            {renderBoolean(toggleItem, false)}
            {numberItems.map(renderNumber)}
          </>
        )}

        {group.kind === 'pair' && fields.map(renderNumber)}

        {group.kind === 'skill' && (
          <>
            {toggleItem && renderBoolean(toggleItem, false)}
            {fields.filter(item => item !== toggleItem).map(item => (
              item.valueType === 'integer' ? renderNumber(item) : null
            ))}
          </>
        )}
      </div>

      {crossError && <div className="config-warning" role="alert">{crossError}</div>}
      {error && <div className="config-error" role="alert">{error}</div>}

      <footer className="config-card-footer">
        <span className="config-updated">{latestUpdated(fields)}</span>
        <div className="config-card-actions">
          {dirty && (
            <button type="button" className="config-cancel-button" disabled={isSaving} onClick={cancel}>
              Hoàn tác
            </button>
          )}
          <button
            type="button"
            className="config-save-button"
            disabled={!dirty || isSaving || hasValidationErrors}
            onClick={() => void apply()}
          >
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </footer>
    </article>
  );
};
