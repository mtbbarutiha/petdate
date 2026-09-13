/**
 * Practical in-domain knowledge packs for the 3 AI backends.
 *
 * - Static curated snippets (books / ops playbooks) always available offline.
 * - Daily refresh stamp: if AI_CONSULT_API_KEY is set, optionally asks the LLM
 *   for a short refreshed digest and caches it in-process until next UTC day.
 * - Not vaporware: generateAiConsultAdvice injects `knowledgeForPrompt(kind)`.
 */
import type { TeamAgentBackend } from '@petdate/shared';
import fs from 'fs';
import path from 'path';

export type KnowledgePack = {
  backend: TeamAgentBackend;
  updatedAt: string;
  source: 'static' | 'llm_refresh' | 'static+llm';
  bullets: string[];
};

const STATIC: Record<TeamAgentBackend, string[]> = {
  vet: [
    'اورژانس: تنگی نفس، تشنج، خونریزی فعال، بلع سم → فوری دامپزشک حضوری.',
    'دارو بدون تجویز شروع نشود؛ دوز انسانی برای پت خطرناک است.',
    'توله/گربه جوان: واکسیناسیون و انگل‌زدایی طبق پروتکل محلی.',
    'استفراغ/اسهال مکرر + بی‌حالی → ارزیابی حضوری، نه خوددرمانی.',
    'منابع: منابع دامپزشکی عمومی + راهنمای اورژانس پت (خلاصه عملی).',
  ],
  trainer: [
    'تقویت مثبت و کلیکر؛ تنبیه بدنی / خفه / شوک / آلفا رول ممنوع.',
    'Culture Clash (Donaldson) · The Puppy Primer (McConnell) — اصول فاصله امن و شکل‌دهی.',
    'فرمان‌های پایه: بشین، بمان، بیا، قلاده — جلسات کوتاه پرتکرار.',
    'توله ≠ بالغ؛ گربه ≠ سگ — برنامه را با گونه/سن تنظیم کن.',
    'اضطراب جدایی: جدایی‌های خیلی کوتاه + آرامش، نه تنبیه هنگام برگشت.',
  ],
  support: [
    'ورود وب: OTP پیامک — همان شماره حساب تلگرام را یکی می‌کند.',
    'پت: ثبت از «پت‌های من»؛ بدون پت برخی مشاوره‌ها قفل است.',
    'همبازی / مربی / دامپزشک از پنل نقش؛ AI رایگان وقتی انسان آنلاین نیست.',
    'شاپ و سکه: کیف پول → شارژ/رسید؛ خطا = متن خطا + اسکرین.',
    'تیکت CRM صف پشتیبانی (q_support)؛ پیگیری و SMS از ابزارهای ایجنت.',
    'اگر نمی‌دانی چه کنی → ارجاع به محمد (اپراتور) با تیکت اولویت‌دار.',
  ],
};

type CacheEntry = { day: string; bullets: string[] };
const llmCache = new Map<TeamAgentBackend, CacheEntry>();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function cacheFilePath(backend: TeamAgentBackend): string {
  const dir =
    process.env.AGENT_KNOWLEDGE_CACHE_DIR ||
    path.join(process.env.TMPDIR || '/tmp', 'petdate-agent-knowledge');
  return path.join(dir, `${backend}-${utcDay()}.json`);
}

function readDiskCache(backend: TeamAgentBackend): string[] | null {
  try {
    const p = cacheFilePath(backend);
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as { bullets?: string[] };
    return Array.isArray(raw.bullets) ? raw.bullets.filter((b) => typeof b === 'string') : null;
  } catch {
    return null;
  }
}

function writeDiskCache(backend: TeamAgentBackend, bullets: string[]): void {
  try {
    const p = cacheFilePath(backend);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ day: utcDay(), bullets, at: new Date().toISOString() }), 'utf8');
  } catch {
    /* ignore disk errors — in-memory still works */
  }
}

function envKey(): string {
  return String(process.env.AI_CONSULT_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

function envBaseUrl(): string {
  return String(
    process.env.AI_CONSULT_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  )
    .trim()
    .replace(/\/$/, '');
}

function envModel(): string {
  return String(process.env.AI_CONSULT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
}

async function refreshFromLlm(backend: TeamAgentBackend): Promise<string[] | null> {
  const key = envKey();
  if (!key) return null;
  const topic =
    backend === 'vet'
      ? 'veterinary pet first-aid and general care (no prescriptions)'
      : backend === 'trainer'
        ? 'positive-reinforcement dog/cat training (Donaldson/McConnell style)'
        : 'PetDate product support: OTP login, pets, playmates, shop, coins, tickets';
  try {
    const res = await fetch(`${envBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: envModel(),
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'Return 4-6 short Persian bullet tips only (no numbering), practical for chat agents. No diagnosis, no drug doses.',
          },
          {
            role: 'user',
            content: `Daily refresh digest for ${topic}. Today UTC ${utcDay()}.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const bullets = text
      .split('\n')
      .map((l) => l.replace(/^[\s*•\-–\d.)]+/, '').trim())
      .filter((l) => l.length > 8)
      .slice(0, 6);
    return bullets.length ? bullets : null;
  } catch {
    return null;
  }
}

/** Sync pack for prompts (static + any cached daily refresh). */
export function knowledgePack(backend: TeamAgentBackend): KnowledgePack {
  const day = utcDay();
  const mem = llmCache.get(backend);
  let refreshed = mem && mem.day === day ? mem.bullets : null;
  if (!refreshed) {
    refreshed = readDiskCache(backend);
    if (refreshed) llmCache.set(backend, { day, bullets: refreshed });
  }
  const staticBullets = STATIC[backend];
  if (refreshed?.length) {
    return {
      backend,
      updatedAt: day,
      source: 'static+llm',
      bullets: [...staticBullets, ...refreshed],
    };
  }
  return {
    backend,
    updatedAt: day,
    source: 'static',
    bullets: staticBullets,
  };
}

export function knowledgeForPrompt(backend: TeamAgentBackend): string {
  const pack = knowledgePack(backend);
  return [
    `دانش حوزه (${pack.backend}) — به‌روز ${pack.updatedAt} (${pack.source}):`,
    ...pack.bullets.map((b) => `• ${b}`),
  ].join('\n');
}

/**
 * Fire-and-forget daily refresh. Safe to call on boot / first consult of the day.
 * Without API key, keeps static pack only.
 */
export async function ensureDailyKnowledgeRefresh(
  backends: TeamAgentBackend[] = ['vet', 'trainer', 'support']
): Promise<void> {
  const day = utcDay();
  await Promise.all(
    backends.map(async (backend) => {
      const mem = llmCache.get(backend);
      if (mem && mem.day === day) return;
      const disk = readDiskCache(backend);
      if (disk) {
        llmCache.set(backend, { day, bullets: disk });
        return;
      }
      const fresh = await refreshFromLlm(backend);
      if (fresh?.length) {
        llmCache.set(backend, { day, bullets: fresh });
        writeDiskCache(backend, fresh);
      }
    })
  );
}
