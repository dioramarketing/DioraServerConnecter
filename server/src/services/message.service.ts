import { prisma } from '../lib/prisma.js';

export async function sendMessage(params: {
  senderId: string;
  recipientId?: string;
  channelId?: string;
  content: string;
}) {
  if (!params.recipientId && !params.channelId) {
    throw new Error('Either recipientId or channelId required');
  }

  return prisma.message.create({
    data: {
      senderId: params.senderId,
      recipientId: params.recipientId || null,
      channelId: params.channelId || null,
      content: params.content,
    },
    include: {
      sender: { select: { id: true, username: true } },
    },
  });
}

export async function getDirectMessages(userId1: string, userId2: string, options?: { limit?: number; before?: string }) {
  return prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId1, recipientId: userId2 },
        { senderId: userId2, recipientId: userId1 },
      ],
      ...(options?.before && { createdAt: { lt: new Date(options.before) } }),
    },
    include: {
      sender: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  });
}

export async function getChannelMessages(channelId: string, options?: { limit?: number; before?: string }) {
  return prisma.message.findMany({
    where: {
      channelId,
      ...(options?.before && { createdAt: { lt: new Date(options.before) } }),
    },
    include: {
      sender: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  });
}

export async function markMessageRead(messageId: string, userId: string) {
  return prisma.message.updateMany({
    where: { id: messageId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function getUnreadMessageCount(userId: string) {
  return prisma.message.count({
    where: { recipientId: userId, readAt: null },
  });
}
