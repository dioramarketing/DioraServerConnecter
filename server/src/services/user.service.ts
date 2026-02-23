import { prisma } from '../lib/prisma.js';
import { logActivity } from './audit.service.js';

export async function listUsers() {
  return prisma.user.findMany({
    where: { status: { not: 'DELETED' } },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      resourceAllocation: true,
      containers: {
        select: { id: true, status: true, sshPort: true },
      },
      _count: { select: { devices: true, sshKeys: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getUser(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      resourceAllocation: true,
      containers: true,
      devices: true,
      sshKeys: { where: { isActive: true } },
    },
  });
}

export async function updateUser(params: {
  userId: string;
  data: { email?: string; role?: 'ADMIN' | 'USER'; status?: 'ACTIVE' | 'SUSPENDED' };
  updatedBy: string;
  ipAddress?: string;
}) {
  const user = await prisma.user.update({
    where: { id: params.userId },
    data: params.data,
  });

  const changes = Object.entries(params.data).map(([k, v]) => `${k}=${v}`).join(', ');
  await logActivity({
    userId: params.updatedBy,
    activityType: params.data.status === 'SUSPENDED' ? 'USER_SUSPEND' : 'USER_UPDATE',
    description: `Updated user "${user.username}": ${changes}`,
    ipAddress: params.ipAddress,
    metadata: { targetUserId: params.userId },
  });

  return user;
}

export async function deleteUser(params: {
  userId: string;
  deletedBy: string;
  ipAddress?: string;
}) {
  const user = await prisma.user.update({
    where: { id: params.userId },
    data: { status: 'DELETED' },
  });

  await logActivity({
    userId: params.deletedBy,
    activityType: 'USER_DELETE',
    description: `Deleted user "${user.username}"`,
    ipAddress: params.ipAddress,
    metadata: { targetUserId: params.userId },
  });

  return user;
}

export async function updateResourceAllocation(params: {
  userId: string;
  cpuCores?: number;
  memoryMb?: number;
  storageSsdGb?: number;
  storageHddGb?: number;
  updatedBy: string;
  ipAddress?: string;
}) {
  const allocation = await prisma.resourceAllocation.upsert({
    where: { userId: params.userId },
    update: {
      ...(params.cpuCores !== undefined && { cpuCores: params.cpuCores }),
      ...(params.memoryMb !== undefined && { memoryMb: params.memoryMb }),
      ...(params.storageSsdGb !== undefined && { storageSsdGb: params.storageSsdGb }),
      ...(params.storageHddGb !== undefined && { storageHddGb: params.storageHddGb }),
    },
    create: {
      userId: params.userId,
      cpuCores: params.cpuCores,
      memoryMb: params.memoryMb,
      storageSsdGb: params.storageSsdGb,
      storageHddGb: params.storageHddGb,
    },
  });

  await logActivity({
    userId: params.updatedBy,
    activityType: 'RESOURCE_UPDATE',
    description: `Updated resource allocation for user ${params.userId}`,
    ipAddress: params.ipAddress,
    metadata: { allocation },
  });

  return allocation;
}
