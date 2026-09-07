/** PM2 process file — production PetDate */
const path = require('path');

/** SQLite file kept as local backup; live SoT is Postgres when DATABASE_URL is set. */
const DATABASE_PATH = path.join(__dirname, 'packages/api/data/petdate.db');
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://petdate:petdate@127.0.0.1:5432/petdate';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

module.exports = {
  apps: [
    {
      name: 'petdate-api',
      cwd: __dirname,
      script: 'packages/api/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        NODE_OPTIONS: '--dns-result-order=ipv4first',
        DATABASE_PATH,
        DATABASE_URL,
      },
    },
    {
      name: 'petdate-bot',
      cwd: __dirname,
      script: 'packages/bot/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--dns-result-order=ipv4first',
        DATABASE_PATH,
        DATABASE_URL,
        API_URL,
      },
    },
  ],
};
