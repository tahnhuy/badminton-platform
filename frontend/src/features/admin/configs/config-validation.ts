import { getConfigUiMeta } from './config-ui-meta';
import type { ConfigItem } from './types/config';

function rangeText(item: ConfigItem, label: string): string {
  const unit = getConfigUiMeta(item).unit ? ` ${getConfigUiMeta(item).unit}` : '';
  if (item.min !== null && item.max !== null) {
    return `${label} phải từ ${item.min} đến ${item.max}${unit}.`;
  }
  if (item.min !== null) {
    return item.min === 0
      ? `${label} không được nhỏ hơn 0${unit}.`
      : `${label} phải từ ${item.min}${unit} trở lên.`;
  }
  if (item.max !== null) {
    return `${label} không được lớn hơn ${item.max}${unit}.`;
  }
  return `${label} không hợp lệ.`;
}

/** Returns a natural-language warning for the current draft, or null when valid. */
export function validateConfigDraft(item: ConfigItem, raw: string): string | null {
  const label = getConfigUiMeta(item).label;

  if (item.valueType === 'boolean') return null;

  if (item.valueType === 'enum') {
    return (item.allowedValues ?? []).includes(raw)
      ? null
      : `Vui lòng chọn ${label.toLowerCase()}.`;
  }

  const trimmed = raw.trim();
  if (!trimmed) return `Vui lòng nhập ${label.toLowerCase()}.`;
  if (!/^-?\d+$/.test(trimmed)) return `${label} phải là số nguyên.`;

  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return `${label} phải là số nguyên.`;
  if (item.min !== null && value < item.min) return rangeText(item, label);
  if (item.max !== null && value > item.max) return rangeText(item, label);

  return null;
}

export function naturalApiError(error: unknown, fallback: string): string {
  const apiError = error as { code?: string; message?: string } | null;
  if (apiError?.code === 'CONFIG_VALUE_INVALID') {
    return 'Giá trị chưa hợp lệ. Vui lòng kiểm tra lại các ô nhập.';
  }
  if (apiError?.code === 'CONFIG_KEY_READ_ONLY') {
    return 'Cấu hình này chỉ đọc và không thể chỉnh sửa.';
  }
  return apiError?.message || fallback;
}
