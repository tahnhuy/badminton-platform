import { loadConfigValues, clearConfigCache } from './config-registry';

// Typed facade for the Report keys (matrix §8.6; RP-06).
const reportKeys = ['REPORT_ENABLED', 'REPORT_HIGH_RISK_THRESHOLD', 'REPORT_HIGH_RISK_WINDOW_HOURS'] as const;

export interface ReportConfig {
  enabled: boolean;
  highRiskThreshold: number;
  highRiskWindowHours: number;
}

export const reportConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<ReportConfig> {
    const values = await loadConfigValues(reportKeys);
    return {
      enabled: values.REPORT_ENABLED,
      highRiskThreshold: values.REPORT_HIGH_RISK_THRESHOLD,
      highRiskWindowHours: values.REPORT_HIGH_RISK_WINDOW_HOURS,
    };
  },
};
