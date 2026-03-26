/**
 * JWT authentication middleware.
 * Verifies the SignaKit session JWT (not the Supabase JWT).
 */
import { createMiddleware } from 'hono/factory';
import * as jose from 'jose';
import { env } from '../config/env';

export interface AuthPayload {
  sub: string;       // wallet_users.id
  authId: string;    // supabase_auth_id
  deviceId: string;
  iat: number;
  exp: number;
}

// Extend Hono context
declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthPayload;
  }
}

const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Middleware: require a valid SignaKit session JWT.
 * Sets c.get('auth') with the decoded payload.
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'AUTH_SESSION_EXPIRED', message: 'Missing token', userMessage: 'Please log in.', retryable: false } }, 401);
  }

  const token = header.slice(7);

  try {
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    c.set('auth', payload as unknown as AuthPayload);
    await next();
  } catch {
    return c.json({ error: { code: 'AUTH_SESSION_EXPIRED', message: 'Invalid or expired token', userMessage: 'Session expired. Please log in again.', retryable: false } }, 401);
  }
});

/**
 * Issue a new SignaKit session JWT.
 */
export async function issueSessionJWT(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret);
}
