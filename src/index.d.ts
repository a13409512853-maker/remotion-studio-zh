export interface StudioLanguageOptions {
  locale?: 'zh-CN' | 'en';
  projectRoot?: string;
  dictionary?: Record<string, string>;
}

export declare function withStudioLanguage<T extends object>(
  config: T,
  options?: StudioLanguageOptions,
): T;

export declare function registerStudioLanguage<T extends object>(
  configApi: {overrideBundlerConfig?: (override: (config: T) => T) => void},
  options?: StudioLanguageOptions,
): boolean;
