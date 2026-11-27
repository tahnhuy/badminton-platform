import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleAlert, RefreshCw, SearchX } from 'lucide-react';
import { AdminHeader } from '../../components/AdminHeader';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminMain } from '../../components/AdminMain';
import { PageHeader } from '@/components/common/page-layout';
import { EmptyState } from '@/components/common/empty-state';
import { FilterToolbar } from '@/components/common/filter-toolbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastContainer, type ToastMessage } from '../../components/Toast';
import { cn } from '@/shared/utils/cn';
import { ApiError } from '../../../../shared/api/http-client';
import { adminConfigService } from '../services/admin-config-service';
import { DOMAIN_DESCRIPTIONS, getConfigUiMeta } from '../config-ui-meta';
import { CONFIG_GROUPS, HIDDEN_CONFIG_KEYS } from '../config-groups';
import { naturalApiError, validateConfigDraft } from '../config-validation';
import { ConfigGroupCard, type ConfigUpdate } from '../components/ConfigGroupCard';
import { ConfigRadioOption } from '../components/ConfigRadioOption';
import {
  CONFIG_DOMAINS,
  DOMAIN_LABELS,
  type ConfigDomain,
  type ConfigItem,
} from '../types/config';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function updatedLabel(item: ConfigItem): string {
  if (item.updatedBy) return `${formatDate(item.updatedAt)} · Admin #${item.updatedBy}`;
  return item.updatedAt ? formatDate(item.updatedAt) : 'Chưa có thay đổi';
}

interface ConfigCardProps {
  item: ConfigItem;
  onSave: (item: ConfigItem, value: string | number | boolean) => Promise<void>;
}

const ConfigCard: React.FC<ConfigCardProps> = ({ item, onSave }) => {
  const meta = getConfigUiMeta(item);
  const [draft, setDraft] = useState(item.configValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = draft !== item.configValue;
  const isBoolean = item.valueType === 'boolean';
  const booleanLabels = meta.booleanLabels ?? { true: 'Bật', false: 'Tắt' };
  const validationError = validateConfigDraft(item, draft);

  const updateDraft = (value: string) => {
    setDraft(value);
    setError('');
  };

  const apply = async () => {
    if (!dirty || !item.editable || validationError) return;
    let value: string | number | boolean = draft;
    if (isBoolean) value = draft === 'true';
    if (item.valueType === 'integer') value = Number(draft);

    setIsSaving(true);
    setError('');
    try {
      await onSave(item, value);
    } catch (err) {
      setError(naturalApiError(err, 'Không thể lưu cấu hình.'));
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = () => {
    setDraft(item.configValue);
    setError('');
  };

  return (
    <article className={cn('flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm', !item.editable && 'bg-muted/30')}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold leading-6">{meta.label}</h3>
        <div className="flex flex-wrap justify-end gap-1">
          {item.usingDefault && <Badge className="bg-info-bg text-info">Đang dùng mặc định</Badge>}
          {!item.editable && <Badge className="bg-caution-bg text-caution">Chỉ đọc</Badge>}
        </div>
      </header>

      <p className="min-h-9 text-sm leading-5 text-muted-foreground">{meta.description}</p>

      <div className="flex min-h-10 items-center">
        {isBoolean && (
          <div className="flex w-full flex-col gap-2" role="radiogroup" aria-label={meta.label}>
            <ConfigRadioOption name={item.configKey} checked={draft === 'true'} disabled={!item.editable || isSaving}
              label={booleanLabels.true} onChange={() => updateDraft('true')} />
            <ConfigRadioOption name={item.configKey} checked={draft === 'false'} disabled={!item.editable || isSaving}
              label={booleanLabels.false} onChange={() => updateDraft('false')} />
          </div>
        )}

        {item.valueType === 'integer' && (
          <div className="flex w-full flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input type="number" value={draft} min={item.min ?? undefined} max={item.max ?? undefined}
                disabled={!item.editable || isSaving} aria-label={meta.label}
                onChange={event => updateDraft(event.target.value)} className="h-9 font-bold" />
              {meta.unit && <span className="shrink-0 text-xs font-bold text-muted-foreground">{meta.unit}</span>}
            </div>
            <span className="text-2xs text-muted-foreground">
              {item.min ?? '—'} đến {item.max ?? 'không giới hạn'}
            </span>
          </div>
        )}

        {item.valueType === 'enum' && (
          <Select value={draft} disabled={!item.editable || isSaving} aria-label={meta.label}
            onChange={updateDraft} className="h-9"
            options={(item.allowedValues ?? []).map(value => ({ value, label: meta.optionLabels?.[value] ?? value }))} />
        )}
      </div>

      {validationError && <div className="rounded-lg bg-caution-bg p-2.5 text-xs font-semibold text-caution" role="alert">{validationError}</div>}

      {!item.editable && <p className="rounded-lg bg-muted/40 p-2.5 text-xs font-semibold text-muted-foreground">Cấu hình này là legacy/chỉ đọc và không thể chỉnh sửa.</p>}

      {error && <div className="rounded-lg bg-danger-bg p-2.5 text-xs font-semibold text-danger" role="alert">{error}</div>}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-2xs text-muted-foreground">{updatedLabel(item)}</span>
        {item.editable && (
          <div className="flex items-center gap-1.5">
            {dirty && <Button type="button" variant="ghost" className="h-9 px-3" disabled={isSaving} onClick={cancel}>Hoàn tác</Button>}
            <Button type="button" variant="brand" className="h-9 px-3.5"
              disabled={!dirty || isSaving || Boolean(validationError)} onClick={() => void apply()}>
              {isSaving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        )}
      </footer>
    </article>
  );
};

export const SystemConfigPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const focusedKey = searchParams.get('key') ?? '';
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [domain, setDomain] = useState<ConfigDomain | ''>('');
  const [search, setSearch] = useState(focusedKey);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const addToast = (type: ToastMessage['type'], message: string) => {
    const id = `${Date.now()}-${toastIdRef.current++}`;
    setToasts(current => [...current, { id, type, message }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 4000);
  };

  useEffect(() => {
    if (focusedKey) setSearch(focusedKey);
  }, [focusedKey]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setListError('');
    try {
      const response = await adminConfigService.list({ limit: 500 });
      setConfigs(response.data.filter(item => !HIDDEN_CONFIG_KEYS.has(item.configKey)));
    } catch (error) {
      setConfigs([]);
      setListError(error instanceof ApiError ? error.message : 'Không thể tải danh sách cấu hình.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMany = async (updates: ConfigUpdate[], label: string) => {
    try {
      for (const update of updates) {
        const updated = await adminConfigService.update(update.item.configKey, update.value);
        setConfigs(current => current.map(config => (config.configKey === updated.configKey ? updated : config)));
      }
      addToast('success', `Đã lưu "${label}". Giá trị mới áp dụng trong tối đa 60 giây.`);
    } catch (error) {
      addToast('error', error instanceof ApiError ? error.message : 'Không thể lưu cấu hình.');
      throw error;
    }
  };

  const saveConfig = (item: ConfigItem, value: string | number | boolean) =>
    saveMany([{ item, value }], getConfigUiMeta(item).label);

  const query = search.trim().toLowerCase();
  const itemMatches = (item: ConfigItem): boolean => {
    if (!query) return true;
    const meta = getConfigUiMeta(item);
    return meta.label.toLowerCase().includes(query)
      || meta.description.toLowerCase().includes(query)
      || item.configKey.toLowerCase().includes(query);
  };

  const itemsByKey = new Map(configs.map(item => [item.configKey, item]));
  const sections = CONFIG_DOMAINS.map(configDomain => {
    const completeGroups = CONFIG_GROUPS
      .filter(group => group.domain === configDomain)
      .map(group => ({
        group,
        items: group.keys
          .map(key => itemsByKey.get(key))
          .filter((item): item is ConfigItem => Boolean(item)),
      }))
      .filter(({ group, items }) => items.length === group.keys.length)
      .filter(({ group, items }) => !query
        || group.title.toLowerCase().includes(query)
        || group.description.toLowerCase().includes(query)
        || items.some(itemMatches));

    const renderedKeys = new Set(
      completeGroups.flatMap(({ items }) => items.map(item => item.configKey)),
    );
    const standalone = configs
      .filter(item => item.domain === configDomain && !renderedKeys.has(item.configKey))
      .filter(itemMatches);

    const units = [
      ...completeGroups.map(({ group, items }) => ({ kind: 'group' as const, group, items })),
      ...standalone.map(item => ({ kind: 'item' as const, item })),
    ];

    return { domain: configDomain, units };
  }).filter(section => (!domain || section.domain === domain) && section.units.length > 0);

  const visibleCount = sections.reduce(
    (total, section) => total + section.units.reduce(
      (sum, unit) => sum + (unit.kind === 'group' ? unit.items.length : 1),
      0,
    ),
    0,
  );

  const clearFilters = () => {
    setSearch('');
    setDomain('');
  };

  return (
    <div className="flex min-h-svh bg-background font-sans text-foreground">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <AdminMain isCollapsed={isCollapsed}>
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
        />

        <main id="admin-main-content" tabIndex={-1}
          className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
          <PageHeader
            title="Cấu hình hệ thống"
            description="Điều chỉnh các thông số theo từng nhóm nghiệp vụ. Thay đổi áp dụng cho giao dịch mới trong tối đa 60 giây."
            actions={<Button type="button" variant="outline" disabled={isLoading} onClick={() => void load()}>
              <RefreshCw aria-hidden="true" />
              Làm mới
            </Button>}
          />

          <FilterToolbar
            search={{ value: search, onChange: setSearch, placeholder: 'Tìm theo chức năng hoặc mô tả...' }}
            filters={[{
              id: 'domain', value: domain, placeholder: 'Tất cả nhóm',
              options: CONFIG_DOMAINS.map(value => ({ value, label: DOMAIN_LABELS[value] })),
              onChange: value => setDomain(value as ConfigDomain | ''),
              ariaLabel: 'Lọc theo nhóm cấu hình',
            }]}
            activeChips={domain ? [{
              id: 'domain',
              label: `Nhóm: ${DOMAIN_LABELS[domain]}`,
              onRemove: () => setDomain(''),
            }] : []}
            rightActions={<span className="self-center text-sm font-semibold whitespace-nowrap text-muted-foreground">{visibleCount} cấu hình</span>}
            onClearAll={clearFilters}
          />

          {isLoading ? (
            <div role="status" className="flex flex-col gap-3">
              <span className="sr-only">Đang tải cấu hình…</span>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map(index => <Skeleton key={index} className="h-48 w-full rounded-2xl" />)}
              </div>
            </div>
          ) : listError ? (
            <EmptyState role="alert" icon={CircleAlert} title="Không tải được danh sách cấu hình"
              description={listError} action={{ label: 'Thử lại', onClick: () => void load() }} />
          ) : sections.length === 0 ? (
            <EmptyState icon={SearchX} title="Không có cấu hình phù hợp"
              description="Thử xóa bộ lọc hoặc tìm với từ khóa khác." action={{ label: 'Xóa bộ lọc', onClick: clearFilters }} />
          ) : (
            sections.map(section => (
              <section key={section.domain} className="flex flex-col gap-3">
                <header className="flex items-start justify-between gap-3 border-b border-border pb-2">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">{DOMAIN_LABELS[section.domain]}</h2>
                    <p className="text-sm text-muted-foreground">{DOMAIN_DESCRIPTIONS[section.domain]}</p>
                  </div>
                  <Badge>{section.units.reduce(
                    (sum, unit) => sum + (unit.kind === 'group' ? unit.items.length : 1),
                    0,
                  )}</Badge>
                </header>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {section.units.map(unit => (
                    unit.kind === 'group' ? (
                      <ConfigGroupCard
                        key={`${unit.group.id}:${unit.items.map(item => item.configValue).join('|')}`}
                        group={unit.group}
                        items={unit.items}
                        onSave={saveMany}
                      />
                    ) : (
                      <ConfigCard
                        key={`${unit.item.configKey}:${unit.item.configValue}:${unit.item.updatedAt ?? ''}`}
                        item={unit.item}
                        onSave={saveConfig}
                      />
                    )
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </AdminMain>

      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
    </div>
  );
};
