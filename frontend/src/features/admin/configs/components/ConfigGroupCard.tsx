import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getConfigUiMeta } from '../config-ui-meta';
import { naturalApiError, validateConfigDraft } from '../config-validation';
import type { ConfigGroupDefinition } from '../config-groups';
import type { ConfigItem } from '../types/config';
import { ConfigRadioOption } from './ConfigRadioOption';

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
      <div className="flex flex-col gap-1" key={item.configKey}>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-bold">{meta.label}</span>
          {item.usingDefault && <Badge className="bg-info-bg text-info">Mặc định</Badge>}
          {!item.editable && <Badge className="bg-caution-bg text-caution">Chỉ đọc</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" value={drafts[item.configKey]} min={item.min ?? undefined} max={item.max ?? undefined}
            disabled={!item.editable || isSaving} aria-label={meta.label}
            onChange={event => updateDraft(item.configKey, event.target.value)} className="h-9 font-bold" />
          {meta.unit && <span className="shrink-0 text-xs font-bold text-muted-foreground">{meta.unit}</span>}
        </div>
        <span className="text-2xs text-muted-foreground">{item.min ?? '—'} đến {item.max ?? 'không giới hạn'}</span>
        {fieldError && <div className="rounded-lg bg-caution-bg p-2.5 text-xs font-semibold text-caution" role="alert">{fieldError}</div>}
      </div>
    );
  };

  const renderBoolean = (item: ConfigItem, showLabel: boolean) => {
    const meta = getConfigUiMeta(item);
    const labels = meta.booleanLabels ?? { true: 'Bật', false: 'Tắt' };
    return (
      <div className="flex flex-col gap-1" key={item.configKey}>
        {showLabel && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-bold">{meta.label}</span>
            {item.usingDefault && <Badge className="bg-info-bg text-info">Mặc định</Badge>}
            {!item.editable && <Badge className="bg-caution-bg text-caution">Chỉ đọc</Badge>}
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={meta.label}>
          <ConfigRadioOption name={item.configKey} checked={drafts[item.configKey] === 'true'}
            disabled={!item.editable || isSaving} label={labels.true} onChange={() => updateDraft(item.configKey, 'true')} />
          <ConfigRadioOption name={item.configKey} checked={drafts[item.configKey] === 'false'}
            disabled={!item.editable || isSaving} label={labels.false} onChange={() => updateDraft(item.configKey, 'false')} />
        </div>
      </div>
    );
  };

  const renderEnum = (item: ConfigItem) => {
    const meta = getConfigUiMeta(item);
    if (item !== modeItem) return null;
    return (
      <div className="flex flex-wrap gap-2" key={item.configKey} role="radiogroup" aria-label={meta.label}>
        {(item.allowedValues ?? []).map(value => (
          <ConfigRadioOption key={value} name={item.configKey} checked={drafts[item.configKey] === value}
            disabled={!item.editable || isSaving} label={meta.optionLabels?.[value] ?? value}
            onChange={() => updateDraft(item.configKey, value)} />
        ))}
      </div>
    );
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold leading-6">{group.title}</h3>
        <div className="flex flex-wrap justify-end gap-1">
          {fields.some(item => item.usingDefault) && <Badge className="bg-info-bg text-info">Đang dùng mặc định</Badge>}
        </div>
      </header>

      <p className="line-clamp-3 text-sm leading-5 text-muted-foreground">{group.description}</p>

      <div className="flex flex-col gap-2.5">
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

      {crossError && <div className="rounded-lg bg-caution-bg p-2.5 text-xs font-semibold text-caution" role="alert">{crossError}</div>}
      {error && <div className="rounded-lg bg-danger-bg p-2.5 text-xs font-semibold text-danger" role="alert">{error}</div>}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-2xs text-muted-foreground">{latestUpdated(fields)}</span>
        <div className="flex items-center gap-1.5">
          {dirty && <Button type="button" variant="ghost" className="h-9 px-3" disabled={isSaving} onClick={cancel}>Hoàn tác</Button>}
          <Button type="button" variant="brand" className="h-9 px-3.5"
            disabled={!dirty || isSaving || hasValidationErrors} onClick={() => void apply()}>
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </footer>
    </article>
  );
};
