import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdminHeader } from '../../components/AdminHeader';
import { AdminSidebar } from '../../components/AdminSidebar';
import { ToastContainer, type ToastMessage } from '../../components/Toast';
import { SearchIcon } from '../../../../components/common/Icons';
import { ApiError } from '../../../../shared/api/http-client';
import { adminConfigService } from '../services/admin-config-service';
import { DOMAIN_DESCRIPTIONS, getConfigUiMeta } from '../config-ui-meta';
import { CONFIG_GROUPS } from '../config-groups';
import { naturalApiError, validateConfigDraft } from '../config-validation';
import { ConfigGroupCard, type ConfigUpdate } from '../components/ConfigGroupCard';
import {
  CONFIG_DOMAINS,
  DOMAIN_LABELS,
  type ConfigDomain,
  type ConfigItem,
} from '../types/config';
import '../configs.css';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
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

  const updatedLabel = item.updatedBy
    ? `${formatDate(item.updatedAt)} · Admin #${item.updatedBy}`
    : item.updatedAt
      ? formatDate(item.updatedAt)
      : 'Chưa có thay đổi';

  return (
    <article className={`config-card ${item.editable ? '' : 'read-only'}`}>
      <header className="config-card-header">
        <div>
          <h3>{meta.label}</h3>
        </div>
        <div className="config-card-badges">
          {item.usingDefault && <span className="config-badge default">Đang dùng mặc định</span>}
          {!item.editable && <span className="config-badge readonly">Chỉ đọc</span>}
        </div>
      </header>

      <p className="config-card-description">{meta.description}</p>

      <div className="config-card-control">
        {isBoolean && (
          <div className="config-radio-group" role="radiogroup" aria-label={meta.label}>
            <label className={`config-radio ${draft === 'true' ? 'selected' : ''}`}>
              <input
                type="radio"
                name={item.configKey}
                checked={draft === 'true'}
                disabled={!item.editable || isSaving}
                onChange={() => updateDraft('true')}
              />
              <span>{booleanLabels.true}</span>
            </label>
            <label className={`config-radio ${draft === 'false' ? 'selected' : ''}`}>
              <input
                type="radio"
                name={item.configKey}
                checked={draft === 'false'}
                disabled={!item.editable || isSaving}
                onChange={() => updateDraft('false')}
              />
              <span>{booleanLabels.false}</span>
            </label>
          </div>
        )}

        {item.valueType === 'integer' && (
          <div className="config-number-row">
            <div className="config-number-field">
              <input
                type="number"
                value={draft}
                min={item.min ?? undefined}
                max={item.max ?? undefined}
                disabled={!item.editable || isSaving}
                onChange={event => updateDraft(event.target.value)}
                aria-label={meta.label}
              />
              {meta.unit && <span className="config-unit">{meta.unit}</span>}
            </div>
            <span className="config-bounds">
              {item.min ?? '—'} đến {item.max ?? 'không giới hạn'}
            </span>
          </div>
        )}

        {item.valueType === 'enum' && (
          <div className="config-select-row">
            <select
              value={draft}
              disabled={!item.editable || isSaving}
              onChange={event => updateDraft(event.target.value)}
              aria-label={meta.label}
            >
              {(item.allowedValues ?? []).map(value => (
                <option key={value} value={value}>
                  {meta.optionLabels?.[value] ?? value}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {validationError && <div className="config-warning" role="alert">{validationError}</div>}

      {!item.editable && (
        <p className="config-readonly-note">Cấu hình này là legacy/chỉ đọc và không thể chỉnh sửa.</p>
      )}

      {error && <div className="config-error" role="alert">{error}</div>}

      <footer className="config-card-footer">
        <span className="config-updated">{updatedLabel}</span>
        {item.editable && (
          <div className="config-card-actions">
            {dirty && (
              <button type="button" className="config-cancel-button" disabled={isSaving} onClick={cancel}>
                Hoàn tác
              </button>
            )}
            <button
              type="button"
              className="config-save-button"
              disabled={!dirty || isSaving || Boolean(validationError)}
              onClick={() => void apply()}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        )}
      </footer>
    </article>
  );
};

export const SystemConfigPage: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [domain, setDomain] = useState<ConfigDomain | ''>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const addToast = (type: ToastMessage['type'], message: string) => {
    const id = `${Date.now()}-${toastIdRef.current++}`;
    setToasts(current => [...current, { id, type, message }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 4000);
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setListError('');
    try {
      const response = await adminConfigService.list({ limit: 500 });
      setConfigs(response.data);
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

    // Keys not rendered by a complete group fall back to standalone cards, so a
    // registry/UI group mismatch can never hide a configuration.
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

  return (
    <div className="admin-layout">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
        />

        <main className="config-page">
          <div className="page-top-header">
            <div className="page-top-header-info">
              <h1 className="page-top-header-title">Cấu hình hệ thống</h1>
              <p className="page-top-header-desc">
                Điều chỉnh các thông số theo từng nhóm nghiệp vụ. Thay đổi áp dụng cho giao dịch mới trong tối đa 60 giây.
              </p>
            </div>
            <button type="button" className="social-button" disabled={isLoading} onClick={() => void load()}>
              Làm mới
            </button>
          </div>

          <div className="config-toolbar">
            <div className="config-search">
              <SearchIcon size={16} />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Tìm theo chức năng hoặc mô tả..."
              />
            </div>
            <select
              value={domain}
              onChange={event => setDomain(event.target.value as ConfigDomain | '')}
              aria-label="Lọc theo nhóm cấu hình"
            >
              <option value="">Tất cả nhóm</option>
              {CONFIG_DOMAINS.map(value => (
                <option key={value} value={value}>{DOMAIN_LABELS[value]}</option>
              ))}
            </select>
            <span className="config-count">{visibleCount} cấu hình</span>
          </div>

          {listError && (
            <div className="config-error" role="alert">
              {listError}{' '}
              <button type="button" className="social-button" onClick={() => void load()}>Thử lại</button>
            </div>
          )}

          {isLoading ? (
            <div className="config-empty"><strong>Đang tải cấu hình...</strong></div>
          ) : sections.length === 0 ? (
            <div className="config-empty">
              <strong>Không có cấu hình phù hợp</strong>
              <p>Thử xóa bộ lọc hoặc tìm với từ khóa khác.</p>
            </div>
          ) : (
            sections.map(section => (
              <section key={section.domain} className="config-section">
                <header className="config-section-header">
                  <div>
                    <h2>{DOMAIN_LABELS[section.domain]}</h2>
                    <p>{DOMAIN_DESCRIPTIONS[section.domain]}</p>
                  </div>
                  <span className="config-section-count">
                    {section.units.reduce(
                      (sum, unit) => sum + (unit.kind === 'group' ? unit.items.length : 1),
                      0,
                    )}
                  </span>
                </header>
                <div className="config-card-grid">
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
      </div>

      <ToastContainer toasts={toasts} onRemove={id => setToasts(current => current.filter(toast => toast.id !== id))} />
    </div>
  );
};
