import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { deviceCheck } from '../middleware/device-check.js';
import * as sshService from '../services/ssh.service.js';

const registerKeySchema = z.object({
  publicKey: z.string().min(1),
  label: z.string().min(1).max(100),
});

export default async function connectionRoutes(fastify: FastifyInstance) {
  // Get connection info
  fastify.get('/info', { preHandler: [authenticate, deviceCheck] }, async (request, reply) => {
    const info = await sshService.getConnectionInfo(request.user!.sub!);
    return reply.send({ success: true, data: info });
  });

  // Register SSH key
  fastify.post('/ssh-keys', { preHandler: [authenticate, deviceCheck] }, async (request, reply) => {
    const body = registerKeySchema.parse(request.body);
    const key = await sshService.registerSshKey({
      userId: request.user!.sub!,
      deviceId: request.user!.deviceId,
      publicKey: body.publicKey,
      label: body.label,
      ipAddress: request.ip,
    });
    return reply.code(201).send({ success: true, data: key });
  });

  // List my SSH keys
  fastify.get('/ssh-keys', { preHandler: [authenticate] }, async (request, reply) => {
    const keys = await sshService.listSshKeys(request.user!.sub!);
    return reply.send({ success: true, data: keys });
  });

  // Revoke SSH key
  fastify.delete('/ssh-keys/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await sshService.revokeSshKey({
      keyId: id,
      userId: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, message: 'Key revoked' });
  });
}
