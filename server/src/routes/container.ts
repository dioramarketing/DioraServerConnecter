import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { deviceCheck } from '../middleware/device-check.js';
import * as containerService from '../services/container.service.js';

const createSchema = z.object({
  userId: z.string(),
  cpuCores: z.number().min(1).max(8).optional(),
  memoryMb: z.number().min(1024).max(32768).optional(),
  storageSsdGb: z.number().min(0).max(200).optional(),
  storageHddGb: z.number().min(0).max(1000).optional(),
  sshPublicKey: z.string().optional(),
});

export default async function containerRoutes(fastify: FastifyInstance) {
  // List containers (admin only)
  fastify.get('/', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const containers = await containerService.listContainers();
    return reply.send({ success: true, data: containers });
  });

  // Get my container status
  fastify.get('/mine', { preHandler: [authenticate, deviceCheck] }, async (request, reply) => {
    const status = await containerService.getContainerStatus(request.user!.sub!);
    return reply.send({ success: true, data: status });
  });

  // Get specific container status (admin)
  fastify.get('/:userId', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const status = await containerService.getContainerStatus(userId);
    return reply.send({ success: true, data: status });
  });

  // Create container (admin only)
  fastify.post('/', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const container = await containerService.createContainer({
      ...body,
      ipAddress: request.ip,
    });
    return reply.code(201).send({ success: true, data: container });
  });

  // Start container (admin or owner)
  fastify.post('/:userId/start', { preHandler: [authenticate] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    if (request.user!.role !== 'ADMIN' && request.user!.sub !== userId) {
      return reply.code(403).send({ success: false, error: 'Forbidden' });
    }
    await containerService.startContainer(userId, request.ip);
    return reply.send({ success: true, message: 'Container started' });
  });

  // Stop container (admin or owner)
  fastify.post('/:userId/stop', { preHandler: [authenticate] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    if (request.user!.role !== 'ADMIN' && request.user!.sub !== userId) {
      return reply.code(403).send({ success: false, error: 'Forbidden' });
    }
    await containerService.stopContainer(userId, request.ip);
    return reply.send({ success: true, message: 'Container stopped' });
  });

  // Rebuild container (admin only)
  fastify.post('/:userId/rebuild', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    await containerService.rebuildContainer(userId, request.ip);
    return reply.send({ success: true, message: 'Container rebuilt' });
  });

  // Remove container (admin only)
  fastify.delete('/:userId', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    await containerService.removeContainer(userId, request.ip);
    return reply.send({ success: true, message: 'Container removed' });
  });
}
