/**
 * Rate limiting middleware using Upstash Redis.
 * Falls back to no-op in development if Upstash is not configured.
 */
import { createMiddleware } from 'hono/factory';
import { env } from '../config/env';

interface RateLimitConfig {
  window: string;  // e.g., '15m', '1h', '1m'
  max: number;
  keyPrefix: string;
}

// Simple in-memory rate limiter for dev (no Redis needed)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60_000;
  const [, n, unit] = match;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000 };
  return Number(n) * multipliers[unit];
}

/**
 * Create a rate limiting middleware.
 */
export function rateLimit(config: RateLimitConfig) {
  const windowMs = parseWindow(config.window);

  // If Upstash is configured, use it
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return createMiddleware(async (c, next) => {
      // Lazy import to avoid issues when Upstash is not configured
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');

      const redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });

      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(config.max, `${Math.floor(windowMs / 1000)} s`),
        prefix: config.keyPrefix,
      });

      const ip = c.req.header('x-forwarded-for') || 'unknown';
      const { success, remaining, reset } = await limiter.limit(ip);

      c.header('X-RateLimit-Limit', String(config.max));
      c.header('X-RateLimit-Remaining', String(remaining));
      c.header('X-RateLimit-Reset', String(reset));

      if (!success) {
        return c.json({
          error: { code: 'RATE_LIMITED', message: 'Too many requests', userMessage: 'Too many attempts. Please wait.', retryable: true },
        }, 429);
      }

      await next();
    });
  }

  // Fallback: in-memory rate limiter for dev
  return createMiddleware(async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const key = `${config.keyPrefix}:${ip}`;
    const now = Date.now();

    const entry = memoryStore.get(key);
    if (entry && now < entry.resetAt) {
      if (entry.count >= config.max) {
        return c.json({
          error: { code: 'RATE_LIMITED', message: 'Too many requests', userMessage: 'Too many attempts. Please wait.', retryable: true },
        }, 429);
      }
      entry.count++;
    } else {
      memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    }

    await next();
  });
}
