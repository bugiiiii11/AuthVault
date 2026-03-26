import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HealthResponse } from '@signakit/types';
import { env } from './config/env';
import googleAuth from './routes/auth/google';
import emailAuth from './routes/auth/email';
import siweAuth from './routes/auth/siwe';
import sessionRoutes from './routes/auth/session';
import keyRoutes from './routes/keys/generate';
import deviceInitRoutes from './routes/keys/deviceInit';

const app = new Hono();

// CORS
app.use('/*', cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => {
  return c.json<HealthResponse>({ status: 'ok', version: '0.1.0' });
});

// Auth routes
app.route('/api/auth/google', googleAuth);
app.route('/api/auth/email', emailAuth);
app.route('/api/auth/siwe', siweAuth);
app.route('/api/auth', sessionRoutes);

// Key management routes
app.route('/api/keys', keyRoutes);
app.route('/api/keys', deviceInitRoutes);

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: { code: 'SERVER_ERROR', message: err.message, userMessage: 'Something went wrong. Please try again.', retryable: true },
  }, 500);
});

console.log(`SignaKit backend running on port ${env.PORT}`);

serve({ fetch: app.fetch, port: env.PORT });

export default app;
