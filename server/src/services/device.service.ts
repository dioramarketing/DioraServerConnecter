import { prisma } from '../lib/prisma.js';
import { logActivity } from './audit.service.js';
import { sendDeviceApprovalNotice } from './email.service.js';

export async function listDevices(userId?: string) {
  const where = userId ? { userId } : {};
  return prisma.device.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, email: true } },
      approver: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPendingDevices() {
  return prisma.device.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function approveDevice(params: {
  deviceId: string;
  approvedBy: string;
  ipAddress?: string;
}) {
  const device = await prisma.device.update({
    where: { id: params.deviceId },
    data: { status: 'APPROVED', approvedBy: params.approvedBy },
    include: { user: { select: { id: true, username: true, email: true } } },
  });

  await logActivity({
    userId: params.approvedBy,
    activityType: 'DEVICE_APPROVE',
    description: `Approved device "${device.name}" for user "${device.user.username}"`,
    ipAddress: params.ipAddress,
    metadata: { deviceId: device.id, fingerprint: device.fingerprint },
  });

  // Notify user
  await prisma.notification.create({
    data: {
      userId: device.userId,
      type: 'DEVICE_APPROVAL',
      title: '기기 승인됨',
      message: `기기 "${device.name}"이(가) 승인되었습니다.`,
    },
  });

  try {
    await sendDeviceApprovalNotice(device.user.email, device.name, true);
  } catch { /* email failure is non-critical */ }

  return device;
}

export async function rejectDevice(params: {
  deviceId: string;
  rejectedBy: string;
  ipAddress?: string;
}) {
  const device = await prisma.device.update({
    where: { id: params.deviceId },
    data: { status: 'REJECTED' },
    include: { user: { select: { id: true, username: true, email: true } } },
  });

  await logActivity({
    userId: params.rejectedBy,
    activityType: 'DEVICE_REJECT',
    description: `Rejected device "${device.name}" for user "${device.user.username}"`,
    ipAddress: params.ipAddress,
  });

  await prisma.notification.create({
    data: {
      userId: device.userId,
      type: 'DEVICE_APPROVAL',
      title: '기기 거부됨',
      message: `기기 "${device.name}"이(가) 거부되었습니다.`,
    },
  });

  try {
    await sendDeviceApprovalNotice(device.user.email, device.name, false);
  } catch { /* */ }

  return device;
}

export async function revokeDevice(params: {
  deviceId: string;
  revokedBy: string;
  ipAddress?: string;
}) {
  const device = await prisma.device.update({
    where: { id: params.deviceId },
    data: { status: 'REVOKED' },
    include: { user: { select: { id: true, username: true } } },
  });

  // Revoke all sessions for this device
  await prisma.session.updateMany({
    where: { deviceId: params.deviceId, isRevoked: false },
    data: { isRevoked: true },
  });

  // Deactivate SSH keys associated with this device
  await prisma.sshKey.updateMany({
    where: { deviceId: params.deviceId },
    data: { isActive: false },
  });

  await logActivity({
    userId: params.revokedBy,
    activityType: 'DEVICE_REVOKE',
    description: `Revoked device "${device.name}" for user "${device.user.username}"`,
    ipAddress: params.ipAddress,
  });

  return device;
}
