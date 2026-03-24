/**
 * Environment configuration with validation.
 * Fails fast on missing required variables.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  // Application
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: Number(optionalEnv('PORT', '3001')),
  ALLOWED_ORIGINS: optionalEnv('ALLOWED_ORIGINS', 'http://localhost:5173').split(','),

  // Supabase
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // JWT
  JWT_SECRET: requireEnv('AUTHVAULT_JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),

  // Encryption
  ENCRYPTION_MASTER_KEY: requireEnv('AUTHVAULT_ENCRYPTION_MASTER_KEY'),

  // Rate limiting (Upstash)
  UPSTASH_REDIS_REST_URL: optionalEnv('UPSTASH_REDIS_REST_URL', ''),
  UPSTASH_REDIS_REST_TOKEN: optionalEnv('UPSTASH_REDIS_REST_TOKEN', ''),

  // Helpers
  get isDev() { return this.NODE_ENV === 'development'; },
  get isProd() { return this.NODE_ENV === 'production'; },
} as const;
