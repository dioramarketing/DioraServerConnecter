import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as deviceService from '../services/device.service.js';

export default async function deviceRoutes(fastify: FastifyInstance) {
  // List all devices (admin) or user's devices
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.role === 'ADMIN' ? undefined : request.user!.sub!;
    const devices = await deviceService.listDevices(userId);
    return reply.send({ success: true, data: devices });
  });

  // Get pending devices (admin only)
  fastify.get('/pending', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const devices = await deviceService.getPendingDevices();
    return reply.send({ success: true, data: devices });
  });

  // Approve device (admin only)
  fastify.post('/:id/approve', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await deviceService.approveDevice({
      deviceId: id,
      approvedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, data: device });
  });

  // Reject device (admin only)
  fastify.post('/:id/reject', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await deviceService.rejectDevice({
      deviceId: id,
      rejectedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, data: device });
  });

  // Revoke device (admin only)
  fastify.post('/:id/revoke', { preHandler: [authenticate, authorize('ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await deviceService.revokeDevice({
      deviceId: id,
      revokedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, data: device });
  });
}
