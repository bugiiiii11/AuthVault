/**
 * Session management routes.
 * GET /me -- get current user info
 * DELETE / -- logout (invalidate session)
 */
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { getUserById } from '../../services/userManager';

const session = new Hono();

// Get current user info
session.get('/me', requireAuth, async (c) => {
  const auth = c.get('auth');

  const user = await getUserById(auth.sub);
  if (!user) {
    return c.json({
      error: { code: 'AUTH_SESSION_EXPIRED', message: 'User not found', userMessage: 'Session expired. Please log in again.', retryable: false },
    }, 401);
  }

  return c.json({ user });
});

// Logout -- client should discard the JWT
// Server-side session invalidation can be added later with a blocklist
session.delete('/', requireAuth, async (c) => {
  // For MVP, logout is client-side (discard JWT)
  // TODO: Add server-side session invalidation (store invalidated JWTs in Redis)
  return c.json({ success: true });
});

export default session;
