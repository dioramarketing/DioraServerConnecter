import { prisma } from '../lib/prisma.js';

interface AuditLogParams {
  userId?: string | null;
  activityType: string;
  description: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logActivity(params: AuditLogParams) {
  return prisma.activityLog.create({
    data: {
      userId: params.userId ?? null,
      activityType: params.activityType,
      description: params.description,
      ipAddress: params.ipAddress ?? null,
      metadata: (params.metadata ?? undefined) as any,
    },
  });
}

export async function getActivityLogs(options: {
  userId?: string;
  activityType?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};
  if (options.userId) where.userId = options.userId;
  if (options.activityType) where.activityType = options.activityType;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { logs, total };
}
