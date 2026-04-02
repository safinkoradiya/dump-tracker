import dotenv from 'dotenv';

dotenv.config();

const WEAK_JWT_SECRETS = new Set([
  'supersecret',
  'replace-with-a-long-random-secret',
  'replace-this-with-a-long-random-secret',
  'changeme',
  'secret',
]);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getJwtSecret() {
  const value = required('JWT_SECRET');

  if (WEAK_JWT_SECRETS.has(value.toLowerCase())) {
    throw new Error('JWT_SECRET must not use a known default placeholder value');
  }

  if (value.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  return value;
}

function getPort() {
  const raw = process.env.PORT?.trim();
  if (!raw) return 3001;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${raw}`);
  }

  return parsed;
}

function getAllowedOrigins() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) {
    return ['http://localhost:5173'];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV?.trim() || 'development',
  PORT: getPort(),
  DATABASE_URL: required('DATABASE_URL'),
  ALLOWED_ORIGINS: getAllowedOrigins(),
};

export const authEnv = {
  JWT_SECRET: getJwtSecret(),
};
