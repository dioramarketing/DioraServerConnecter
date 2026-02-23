import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { API_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS } from '@dsc/shared';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

// Routes
import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/device.js';
import containerRoutes from './routes/container.js';
import connectionRoutes from './routes/connection.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notification.js';
import messageRoutes from './routes/message.js';
import websocketPlugin from './plugins/websocket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  });

  // ── Plugins ──────────────────────────────────────
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(fastifyRateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW_MS,
  });

  await fastify.register(fastifyWebsocket);

  // ── Dashboard SPA static files ───────────────────
  const dashboardPath = join(__dirname, '../../dashboard/dist');
  if (existsSync(dashboardPath)) {
    await fastify.register(fastifyStatic, {
      root: dashboardPath,
      prefix: '/',
      decorateReply: false,
    });
  }

  // ── Error handler ────────────────────────────────
  fastify.setErrorHandler((error: Error & { statusCode?: number; issues?: { path: string[]; message: string }[] }, _request, reply) => {
    const statusCode = error.statusCode || 500;
    fastify.log.error(error);

    // Zod validation errors
    if (error.name === 'ZodError') {
      return reply.code(400).send({
        success: false,
        error: 'Validation error',
        message: error.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join(', '),
      });
    }

    return reply.code(statusCode).send({
      success: false,
      error: statusCode < 500 ? error.message : 'Internal server error',
    });
  });

  // ── API Routes ───────────────────────────────────
  await fastify.register(async (authScope) => {
    // Stricter rate limit for auth endpoints
    await authScope.register(fastifyRateLimit, {
      max: AUTH_RATE_LIMIT_MAX,
      timeWindow: AUTH_RATE_LIMIT_WINDOW_MS,
    });
    await authScope.register(authRoutes);
  }, { prefix: `${API_PREFIX}/auth` });

  await fastify.register(deviceRoutes, { prefix: `${API_PREFIX}/devices` });
  await fastify.register(containerRoutes, { prefix: `${API_PREFIX}/containers` });
  await fastify.register(connectionRoutes, { prefix: `${API_PREFIX}/connection` });
  await fastify.register(adminRoutes, { prefix: `${API_PREFIX}/admin` });
  await fastify.register(notificationRoutes, { prefix: `${API_PREFIX}/notifications` });
  await fastify.register(messageRoutes, { prefix: `${API_PREFIX}/messages` });
  await fastify.register(websocketPlugin);

  // ── SPA fallback ─────────────────────────────────
  if (existsSync(dashboardPath)) {
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith(API_PREFIX) || request.url.startsWith('/ws')) {
        return reply.code(404).send({ success: false, error: 'Not found' });
      }
      return reply.sendFile('index.html', dashboardPath);
    });
  }

  // ── Health check ─────────────────────────────────
  fastify.get(`${API_PREFIX}/health`, async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}

// ── Start ────────────────────────────────────────────
async function main() {
  const server = await buildServer();

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`Server running at http://${host}:${port}`);
    console.log(`API prefix: ${API_PREFIX}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await server.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
