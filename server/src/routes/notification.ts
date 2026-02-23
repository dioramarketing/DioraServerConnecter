import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import * as notificationService from '../services/notification.service.js';

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const query = request.query as { unreadOnly?: string; limit?: string };
    const notifications = await notificationService.getNotifications(request.user!.sub!, {
      unreadOnly: query.unreadOnly === 'true',
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return reply.send({ success: true, data: notifications });
  });

  fastify.get('/unread-count', async (request, reply) => {
    const count = await notificationService.getUnreadCount(request.user!.sub!);
    return reply.send({ success: true, data: { count } });
  });

  fastify.post('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    await notificationService.markAsRead(id, request.user!.sub!);
    return reply.send({ success: true });
  });

  fastify.post('/read-all', async (request, reply) => {
    await notificationService.markAllAsRead(request.user!.sub!);
    return reply.send({ success: true });
  });
}
