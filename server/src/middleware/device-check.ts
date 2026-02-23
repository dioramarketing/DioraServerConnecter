import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function deviceCheck(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.code(401).send({ success: false, error: 'Not authenticated' });
  }

  const device = await prisma.device.findUnique({
    where: { id: request.user.deviceId },
  });

  if (!device || device.status !== 'APPROVED') {
    return reply.code(403).send({ success: false, error: 'Device not approved' });
  }

  // Update last seen
  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });
}
