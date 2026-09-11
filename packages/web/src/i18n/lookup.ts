import type { Dict, TranslateFn } from './types';

function getPath(dict: Dict, key: string): unknown {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function createTranslator(dict: Dict, fallback?: Dict): TranslateFn {
  return (key, vars) => {
    let raw = getPath(dict, key);
    if (typeof raw !== 'string' && fallback) raw = getPath(fallback, key);
    let text = typeof raw === 'string' ? raw : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  };
}
