/**
 * Guard: Telegram HTTP client stays IPv4 + short retries (VPS IPv6 SSL timeout).
 * Run: npx tsx packages/bot/src/telegram-http.selftest.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  grammyClientOptions,
  isRetryableTelegramNetworkError,
  telegramApiRoot,
} from './telegram-http';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const srcPath = join(__dirname, 'telegram-http.ts');
const src = readFileSync(srcPath, 'utf8');

assert(/family:\s*4/.test(src), 'telegram-http must force IPv4 (family: 4)');
assert(/TELEGRAM_HTTP_RETRIES/.test(src), 'telegram-http must cap retries via TELEGRAM_HTTP_RETRIES');
assert(/TELEGRAM_API_ROOT/.test(src), 'telegram-http must honor TELEGRAM_API_ROOT');

assert(telegramApiRoot() === 'https://api.telegram.org', 'default api root');
process.env.TELEGRAM_API_ROOT = 'https://example.invalid/botapi/';
assert(telegramApiRoot() === 'https://example.invalid/botapi', 'strip trailing slash');
delete process.env.TELEGRAM_API_ROOT;

assert(isRetryableTelegramNetworkError(new Error('fetch failed: ECONNRESET')), 'ECONNRESET retryable');
assert(!isRetryableTelegramNetworkError(new Error('400 Bad Request')), '4xx not retryable');

const opts = grammyClientOptions();
assert(typeof opts.fetch === 'function', 'grammy fetch override');
assert(opts.apiRoot === 'https://api.telegram.org', 'grammy apiRoot');

console.log('telegram-http.selftest: ok');
