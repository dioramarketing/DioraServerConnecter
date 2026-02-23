import type { FastifyRequest, FastifyReply } from 'fastify';

export function authorize(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ success: false, error: 'Not authenticated' });
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }
  };
}
