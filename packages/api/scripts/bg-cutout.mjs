/**
 * Isolated cutout process. Do not import sharp here — it crashes onnxruntime.
 * Usage: node scripts/bg-cutout.mjs <input.jpg> <output.png>
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { removeBackground } from '@imgly/background-removal-node';

const require = createRequire(import.meta.url);
const entry = require.resolve('@imgly/background-removal-node');
const publicPath = pathToFileURL(path.dirname(entry) + path.sep).href;

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('usage: bg-cutout.mjs <in> <out>');
  process.exit(2);
}

const blob = await removeBackground(pathToFileURL(path.resolve(input)).href, {
  model: 'medium',
  publicPath,
  output: { format: 'image/png', quality: 0.92 },
});
fs.writeFileSync(output, Buffer.from(await blob.arrayBuffer()));
