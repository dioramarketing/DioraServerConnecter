import { prisma } from '../lib/prisma.js';

export async function getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
  const where: Record<string, unknown> = { userId };
  if (options?.unreadOnly) where.isRead = false;

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  });
}

export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function createNotification(params: {
  userId: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'DEVICE_APPROVAL' | 'SYSTEM';
  title: string;
  message: string;
}) {
  return prisma.notification.create({ data: params });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
