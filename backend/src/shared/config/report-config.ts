import { loadConfigValues, clearConfigCache } from './config-registry';

// Typed facade for the Report keys (matrix §8.6; RP-06).
const reportKeys = ['REPORT_ENABLED'] as const;

export interface ReportConfig {
  enabled: boolean;
}

export const reportConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<ReportConfig> {
    const values = await loadConfigValues(reportKeys);
    return { enabled: values.REPORT_ENABLED };
  },
};
