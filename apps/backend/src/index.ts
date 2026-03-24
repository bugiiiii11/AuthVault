import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HealthResponse } from '@authvault/types';

const app = new Hono();

// CORS
app.use('/*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'],
  credentials: true,
}));

// Health check
app.get('/api/health', (c) => {
  return c.json<HealthResponse>({ status: 'ok', version: '0.1.0' });
});

// Auth routes placeholder
// app.route('/api/auth', authRoutes);

// Key routes placeholder
// app.route('/api/keys', keyRoutes);

const port = Number(process.env.PORT) || 3001;

console.log(`AuthVault backend running on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
