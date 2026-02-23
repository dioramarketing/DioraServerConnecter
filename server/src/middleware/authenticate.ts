import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, type TokenPayload } from '../services/auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ success: false, error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    request.user = await verifyAccessToken(token);
  } catch {
    return reply.code(401).send({ success: false, error: 'Invalid or expired token' });
  }
}
