import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { authenticate } from '../middleware/authenticate.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceFingerprint: z.string().min(1),
  deviceName: z.string().min(1),
  deviceOs: z.string().min(1),
});

const twoFaSchema = z.object({
  sessionId: z.string().min(1),
  code: z.string().length(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const ip = request.ip;
    const result = await authService.login({
      ...body,
      ipAddress: ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ success: true, data: result });
  });

  // 2FA Verify
  fastify.post('/2fa/verify', async (request, reply) => {
    const body = twoFaSchema.parse(request.body);
    const result = await authService.verifyTwoFa({
      ...body,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ success: true, data: result });
  });

  // Refresh token
  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const result = await authService.refreshTokens({
      refreshToken: body.refreshToken,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ success: true, data: result });
  });

  // Logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const token = request.headers.authorization!.slice(7);
    await authService.logout({
      userId: request.user!.sub!,
      accessToken: token,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, message: 'Logged out' });
  });

  // Register (admin only)
  fastify.post('/register', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.user!.role !== 'ADMIN') {
      return reply.code(403).send({ success: false, error: 'Admin only' });
    }
    const body = registerSchema.parse(request.body);
    const user = await authService.registerUser({
      ...body,
      createdByUserId: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.code(201).send({ success: true, data: user });
  });

  // Get current user
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const { sub: userId, username, role, deviceId } = request.user!;
    return reply.send({ success: true, data: { userId, username, role, deviceId } });
  });
}
