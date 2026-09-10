#!/usr/bin/env node
/** Thin wrapper — delegates to TypeScript selftest. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync('npx', ['tsx', path.join(root, 'src/hr-ats-followup.selftest.ts')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
process.exit(r.status ?? 1);
