import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as userService from '../services/user.service.js';
import * as storageService from '../services/storage.service.js';
import * as auditService from '../services/audit.service.js';
import * as monitorService from '../services/monitor.service.js';

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

const resourceSchema = z.object({
  cpuCores: z.number().min(1).max(8).optional(),
  memoryMb: z.number().min(1024).max(32768).optional(),
  storageSsdGb: z.number().min(10).max(200).optional(),
  storageHddGb: z.number().min(50).max(1000).optional(),
});

const sharedFolderSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

const folderMemberSchema = z.object({
  userId: z.string(),
  permission: z.enum(['READ', 'READWRITE']),
});

export default async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require ADMIN role
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('ADMIN'));

  // ── Users ────────────────────────────────────────
  fastify.get('/users', async (request, reply) => {
    const users = await userService.listUsers();
    return reply.send({ success: true, data: users });
  });

  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await userService.getUser(id);
    return reply.send({ success: true, data: user });
  });

  fastify.patch('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateUserSchema.parse(request.body);
    const user = await userService.updateUser({
      userId: id,
      data,
      updatedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, data: user });
  });

  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await userService.deleteUser({
      userId: id,
      deletedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, message: 'User deleted' });
  });

  // ── Resource Allocation ──────────────────────────
  fastify.put('/users/:id/resources', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = resourceSchema.parse(request.body);
    const allocation = await userService.updateResourceAllocation({
      userId: id,
      ...data,
      updatedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, data: allocation });
  });

  // ── Activity Logs ────────────────────────────────
  fastify.get('/logs', async (request, reply) => {
    const query = request.query as { userId?: string; activityType?: string; limit?: string; offset?: string };
    const result = await auditService.getActivityLogs({
      userId: query.userId,
      activityType: query.activityType,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
    return reply.send({ success: true, data: result });
  });

  // ── Metrics ──────────────────────────────────────
  fastify.get('/metrics', async (request, reply) => {
    const metrics = await monitorService.getAllMetrics();
    return reply.send({ success: true, data: metrics });
  });

  fastify.get('/metrics/host', async (request, reply) => {
    const host = await monitorService.getHostMetrics();
    return reply.send({ success: true, data: host });
  });

  // ── Shared Folders ───────────────────────────────
  fastify.get('/shared-folders', async (request, reply) => {
    const folders = await storageService.listSharedFolders();
    return reply.send({ success: true, data: folders });
  });

  fastify.post('/shared-folders', async (request, reply) => {
    const body = sharedFolderSchema.parse(request.body);
    const folder = await storageService.createSharedFolder({
      name: body.name,
      createdBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.code(201).send({ success: true, data: folder });
  });

  fastify.post('/shared-folders/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = folderMemberSchema.parse(request.body);
    const member = await storageService.addFolderMember({
      folderId: id,
      userId: body.userId,
      permission: body.permission,
      addedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.code(201).send({ success: true, data: member });
  });

  fastify.delete('/shared-folders/:id/members/:userId', async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    await storageService.removeFolderMember({
      folderId: id,
      userId,
      removedBy: request.user!.sub!,
      ipAddress: request.ip,
    });
    return reply.send({ success: true, message: 'Member removed' });
  });
}
