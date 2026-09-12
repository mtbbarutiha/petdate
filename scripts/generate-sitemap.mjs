#!/usr/bin/env node
/** Back-compat wrapper — real generator is generate-sitemap.ts */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate-sitemap.ts');
const result = spawnSync(process.execPath, ['--import', 'tsx', script], {
  stdio: 'inherit',
  cwd: path.resolve(path.dirname(script), '..'),
});
if (result.status !== 0) {
  const fallback = spawnSync('npx', ['tsx', script], {
    stdio: 'inherit',
    cwd: path.resolve(path.dirname(script), '..'),
  });
  process.exit(fallback.status ?? 1);
}
