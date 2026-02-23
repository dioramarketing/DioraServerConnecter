import { prisma } from '../lib/prisma.js';
import { logActivity } from './audit.service.js';
import { HDD_SHARED_PATH } from '@dsc/shared';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export async function createSharedFolder(params: {
  name: string;
  createdBy: string;
  ipAddress?: string;
}) {
  const folderPath = join(HDD_SHARED_PATH, params.name);

  if (existsSync(folderPath)) {
    throw new Error(`Folder "${params.name}" already exists`);
  }

  mkdirSync(folderPath, { recursive: true });

  const folder = await prisma.sharedFolder.create({
    data: {
      name: params.name,
      path: folderPath,
      createdBy: params.createdBy,
    },
  });

  await logActivity({
    userId: params.createdBy,
    activityType: 'SHARED_FOLDER_CREATE',
    description: `Created shared folder "${params.name}"`,
    ipAddress: params.ipAddress,
  });

  return folder;
}

export async function listSharedFolders(userId?: string) {
  if (userId) {
    return prisma.sharedFolder.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: {
          include: { user: { select: { id: true, username: true } } },
        },
        creator: { select: { id: true, username: true } },
      },
    });
  }
  return prisma.sharedFolder.findMany({
    include: {
      members: {
        include: { user: { select: { id: true, username: true } } },
      },
      creator: { select: { id: true, username: true } },
    },
  });
}

export async function addFolderMember(params: {
  folderId: string;
  userId: string;
  permission: 'READ' | 'READWRITE';
  addedBy: string;
  ipAddress?: string;
}) {
  const member = await prisma.sharedFolderMember.create({
    data: {
      folderId: params.folderId,
      userId: params.userId,
      permission: params.permission,
    },
  });

  await logActivity({
    userId: params.addedBy,
    activityType: 'SHARED_FOLDER_UPDATE',
    description: `Added member to shared folder`,
    ipAddress: params.ipAddress,
    metadata: { folderId: params.folderId, memberId: params.userId, permission: params.permission },
  });

  return member;
}

export async function removeFolderMember(params: {
  folderId: string;
  userId: string;
  removedBy: string;
  ipAddress?: string;
}) {
  await prisma.sharedFolderMember.delete({
    where: { folderId_userId: { folderId: params.folderId, userId: params.userId } },
  });

  await logActivity({
    userId: params.removedBy,
    activityType: 'SHARED_FOLDER_UPDATE',
    description: `Removed member from shared folder`,
    ipAddress: params.ipAddress,
    metadata: { folderId: params.folderId, memberId: params.userId },
  });
}
