import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import * as fileService from '../services/file.service.js';

export default async function fileRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // List directory
  fastify.get('/ls', async (request, reply) => {
    const { path = '/workspace' } = request.query as { path?: string };
    const entries = await fileService.listDirectory(request.user!.sub!, path);
    return reply.send({ success: true, data: entries });
  });

  // Download file (returns tar archive)
  fastify.get('/read', async (request, reply) => {
    const { path } = request.query as { path: string };
    if (!path) return reply.code(400).send({ success: false, error: 'path required' });
    const buffer = await fileService.readFile(request.user!.sub!, path);
    return reply.header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${path.split('/').pop()}.tar"`)
      .send(buffer);
  });

  // Upload / write file (base64 body)
  fastify.post('/write', async (request, reply) => {
    const body = z.object({
      path: z.string().min(1),
      content: z.string(), // base64 encoded
    }).parse(request.body);
    await fileService.writeFile(request.user!.sub!, body.path, Buffer.from(body.content, 'base64'));
    return reply.send({ success: true });
  });

  // Create directory
  fastify.post('/mkdir', async (request, reply) => {
    const body = z.object({ path: z.string().min(1) }).parse(request.body);
    await fileService.createDirectory(request.user!.sub!, body.path);
    return reply.send({ success: true });
  });

  // Delete file/directory
  fastify.post('/delete', async (request, reply) => {
    const body = z.object({ path: z.string().min(1) }).parse(request.body);
    await fileService.deleteItem(request.user!.sub!, body.path);
    return reply.send({ success: true });
  });

  // Rename / move
  fastify.post('/rename', async (request, reply) => {
    const body = z.object({
      oldPath: z.string().min(1),
      newPath: z.string().min(1),
    }).parse(request.body);
    await fileService.renameItem(request.user!.sub!, body.oldPath, body.newPath);
    return reply.send({ success: true });
  });
}
