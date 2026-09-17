/**
 * Infrastructure configuration from environment variables.
 * Used when migrating from SQLite to PostgreSQL, Redis, and S3/MinIO.
 * SQLite remains the default when DATABASE_URL is unset.
 */

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value === '' ? undefined : value;
}

export const infra = {
  database: {
    url: optional('DATABASE_URL'),
  },
  redis: {
    url: optional('REDIS_URL'),
    /** Optional read replica. Used when USE_REDIS_REPLICA is truthy. */
    readUrl: optional('REDIS_READ_URL'),
  },
  s3: {
    endpoint: optional('S3_ENDPOINT'),
    accessKey: optional('S3_ACCESS_KEY'),
    secretKey: optional('S3_SECRET_KEY'),
    bucket: optional('S3_BUCKET') ?? 'petdate-media',
    region: optional('S3_REGION') ?? 'us-east-1',
    usePathStyle: process.env.S3_USE_PATH_STYLE !== 'false',
    publicUrl: optional('S3_PUBLIC_URL'),
    useSsl: process.env.S3_USE_SSL === 'true',
  },
  telegram: {
    botToken: optional('TELEGRAM_BOT_TOKEN'),
    botUsername: optional('TELEGRAM_BOT_USERNAME'),
    webhookUrl: optional('BOT_WEBHOOK_URL'),
    webhookSecret: optional('BOT_WEBHOOK_SECRET'),
  },
  web: {
    url: optional('PUBLIC_WEB_URL') ?? optional('WEB_URL') ?? 'http://localhost:5173',
  },
  elasticsearch: {
    url: optional('ELASTICSEARCH_URL'),
  },
} as const;

export function hasPostgresConfig(): boolean {
  return Boolean(infra.database.url);
}

export function hasRedisConfig(): boolean {
  return Boolean(infra.redis.url);
}

export function hasS3Config(): boolean {
  return Boolean(infra.s3.endpoint && infra.s3.accessKey && infra.s3.secretKey);
}

export function hasElasticsearchConfig(): boolean {
  return Boolean(infra.elasticsearch.url);
}
