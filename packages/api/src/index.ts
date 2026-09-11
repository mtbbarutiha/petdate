import './load-env';
import dns from 'dns';
import http from 'http';
import express from 'express';
import cors from 'cors';
import type { GameType } from '@petdate/shared';
import { dbService, getDb, getResolvedDatabasePath, getStorageDriver } from './db';
import {
  hasElasticsearchConfig,
  hasPostgresConfig,
  hasRedisConfig,
  hasS3Config,
  infra,
} from './config/infra';
import { catalogRouter } from './routes/catalog';
import {
  consultationsRouter,
  prescriptionsFileRouter,
  prescriptionWebRouter,
} from './routes/consultations';
import path from 'path';
import { gamesRouter } from './routes/games';
import { petsRouter } from './routes/pets';
import { mediaRouter } from './routes/media';
import { playdatesRouter } from './routes/playdates';
import { sectionsRouter } from './routes/sections';
import { usersRouter } from './routes/users';
import { presenceRouter } from './routes/presence';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { shopRouter } from './routes/shop';
import { paymentsRouter } from './routes/payments';
import { newsletterRouter } from './routes/newsletter';
import { petPurchaseLeadsRouter } from './routes/pet-purchase-leads';
import { supportRouter } from './routes/support';
import { analyticsRouter } from './routes/analytics';
import { magazineRouter } from './routes/magazine';
import {
  expressErrorHandler,
  installConsoleErrorBridge,
  installProcessErrorLogging,
  responseErrorLogger,
} from './services/app-logger';
import { attachChatWebSocket } from './ws/chatHub';

// Prefer IPv4 — Telegram notify fetch was timing out on IPv6
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* older Node */
}

getDb();
installConsoleErrorBridge('api');
installProcessErrorLogging('api');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

/** Behind nginx / CDN — trust X-Forwarded-* for correct client IP (rate limits). */
app.set('trust proxy', 1);

const corsOrigins = [
  process.env.WEB_URL,
  process.env.PUBLIC_WEB_URL,
  'https://petdate.ir',
  'https://www.petdate.ir',
  'https://ws.petdate.ir',
]
  .filter(Boolean)
  .map((u) => String(u).replace(/\/$/, ''));

app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? (origin, cb) => {
            // Same-origin / non-browser (bot, curl) — no Origin header
            if (!origin) {
              cb(null, true);
              return;
            }
            const ok = corsOrigins.some((o) => origin === o || origin.startsWith(`${o}/`));
            cb(null, ok);
          }
        : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/api', (_req, res, next) => {
  // Help CDNs keep JSON on API errors (WCDN www still may wrap 4xx — see nginx notes).
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-PetDate-API', '1');
  next();
});
app.use(responseErrorLogger);

// Brand assets (transparent logo for web Rx)
app.use(
  '/assets/brand',
  express.static(path.join(__dirname, 'assets', 'brand'), {
    maxAge: '1d',
    fallthrough: true,
  })
);
app.use(
  '/assets/brand',
  express.static(path.join(__dirname, '..', 'assets', 'brand'), {
    maxAge: '1d',
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'petdate-api' });
});

app.get('/api/health/candoo', async (_req, res) => {
  const { candooBalance, isCandooConfigured } = await import('./services/candoo');
  if (!isCandooConfigured()) {
    res.status(503).json({ ok: false, configured: false, error: 'Candoo env missing' });
    return;
  }
  // Candoo /balance often 500 even when /send works — report sendReady separately.
  const bal = await candooBalance();
  res.status(200).json({
    ok: true,
    configured: true,
    sendReady: true,
    balanceOk: bal.ok,
    balance: bal.balance,
    balanceStatus: bal.status,
    balanceError: bal.ok ? undefined : bal.error,
  });
});

app.get('/api/health/infra', (_req, res) => {
  const driver = getStorageDriver();
  const sqlitePath = getResolvedDatabasePath();
  res.json({
    ok: true,
    service: 'petdate-api',
    storage: driver,
    sqlitePath: sqlitePath || undefined,
    postgresUrlConfigured: hasPostgresConfig(),
    infra: {
      postgresConfigured: hasPostgresConfig(),
      postgresActive: driver === 'postgres',
      redis: hasRedisConfig(),
      s3: hasS3Config(),
      elasticsearch: hasElasticsearchConfig(),
      telegramBot: Boolean(infra.telegram.botToken),
      webUrl: infra.web.url,
    },
  });
});

app.use('/api/catalog', catalogRouter);
app.use('/api/consultations', consultationsRouter);
app.use('/api/prescriptions', prescriptionsFileRouter);
app.use('/rx', prescriptionWebRouter);
app.use('/api/games', gamesRouter);
app.use('/api/pets', petsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/playdate-requests', playdatesRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/presence', presenceRouter);
app.use('/api/shop', shopRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/pet-purchase-leads', petPurchaseLeadsRouter);
app.use('/api/support', supportRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/magazine', magazineRouter);
app.use('/api/admin', adminRouter);

app.get('/api/games-for-section/:sectionId', (req, res) => {
  const sectionId = Number(req.params.sectionId);
  if (Number.isNaN(sectionId)) {
    res.status(400).json({ error: 'شناسه سکشن نامعتبر است' });
    return;
  }
  const section = dbService.getSection(sectionId);
  if (!section) {
    res.status(404).json({ error: 'سکشن پیدا نشد' });
    return;
  }
  const games = dbService.listGames({ sectionId, status: 'open' });
  res.json({ section, games });
});

app.get('/api/my-section-games', (req, res) => {
  const telegramId = req.query.telegramId as string | undefined;
  const userId = req.query.userId ? Number(req.query.userId) : undefined;

  let user = telegramId ? dbService.getUserByTelegramId(telegramId) : null;
  if (!user && userId) user = dbService.getUserById(userId);

  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  if (!user.sectionId) {
    res.status(400).json({ error: 'شما هنوز به سکشنی متصل نیستید', user });
    return;
  }

  const section = dbService.getSection(user.sectionId)!;
  const games = dbService.listGames({ sectionId: user.sectionId, status: 'open' });
  res.json({ user, section, games });
});

app.use(expressErrorHandler);

const server = http.createServer(app);
attachChatWebSocket(server);

server.listen(PORT, () => {
  console.log(`🐾 petdate API روی پورت ${PORT} اجرا شد (WebSocket: /api/ws/chat)`);
  // Sweep stale pending playmate / vet requests every 30s
  const sweep = () => {
    try {
      const pd = dbService.expireStalePlaydateRequests();
      const vc = dbService.expireStaleVetConsultRequests();
      if (pd || vc) {
        console.log(`⏱ expired pending: playdates=${pd} consults=${vc}`);
      }
    } catch (err) {
      console.warn('request expiry sweep failed:', (err as Error).message);
    }
  };
  sweep();
  setInterval(sweep, 30_000).unref?.();
});

export { app, dbService, server };
