export type Lang = 'fa' | 'en';

export type Dict = Record<string, unknown>;

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;
