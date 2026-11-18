export const CONFIG_DOMAINS = [
  'booking',
  'tournament',
  'team',
  'auth',
  'refund',
  'report',
  'matchmaking',
  'social',
  'messaging',
  'player-skill-adjustment',
] as const;

export type ConfigDomain = (typeof CONFIG_DOMAINS)[number];
export type ConfigValueType = 'boolean' | 'integer' | 'enum';

export interface ConfigItem {
  configKey: string;
  configValue: string;
  valueType: ConfigValueType;
  domain: ConfigDomain;
  description: string;
  documentedDefault: string;
  usingDefault: boolean;
  updatedAt: string | null;
  updatedBy: number | null;
  editable: boolean;
  allowedValues: string[] | null;
  min: number | null;
  max: number | null;
}

export interface ConfigListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ConfigListResponse {
  data: ConfigItem[];
  meta: ConfigListMeta;
}

export interface ConfigListParams {
  domain?: ConfigDomain;
  page?: number;
  limit?: number;
}

export const DOMAIN_LABELS: Record<ConfigDomain, string> = {
  booking: 'Đặt sân',
  tournament: 'Giải đấu',
  team: 'Đội thi đấu',
  auth: 'Xác thực',
  refund: 'Hoàn tiền',
  report: 'Báo cáo',
  matchmaking: 'Tìm kèo',
  social: 'Cộng đồng',
  messaging: 'Tin nhắn',
  'player-skill-adjustment': 'Điều chỉnh trình độ',
};
