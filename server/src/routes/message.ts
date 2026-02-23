import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import * as messageService from '../services/message.service.js';

const sendSchema = z.object({
  recipientId: z.string().optional(),
  channelId: z.string().optional(),
  content: z.string().min(1).max(5000),
});

export default async function messageRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Send message
  fastify.post('/', async (request, reply) => {
    const body = sendSchema.parse(request.body);
    const message = await messageService.sendMessage({
      senderId: request.user!.sub!,
      ...body,
    });
    return reply.code(201).send({ success: true, data: message });
  });

  // Get DMs with specific user
  fastify.get('/dm/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const query = request.query as { limit?: string; before?: string };
    const messages = await messageService.getDirectMessages(request.user!.sub!, userId, {
      limit: query.limit ? Number(query.limit) : undefined,
      before: query.before,
    });
    return reply.send({ success: true, data: messages });
  });

  // Get channel messages
  fastify.get('/channel/:channelId', async (request, reply) => {
    const { channelId } = request.params as { channelId: string };
    const query = request.query as { limit?: string; before?: string };
    const messages = await messageService.getChannelMessages(channelId, {
      limit: query.limit ? Number(query.limit) : undefined,
      before: query.before,
    });
    return reply.send({ success: true, data: messages });
  });

  // Mark as read
  fastify.post('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    await messageService.markMessageRead(id, request.user!.sub!);
    return reply.send({ success: true });
  });

  // Unread count
  fastify.get('/unread-count', async (request, reply) => {
    const count = await messageService.getUnreadMessageCount(request.user!.sub!);
    return reply.send({ success: true, data: { count } });
  });
}
