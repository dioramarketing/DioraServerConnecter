import { prisma } from '../lib/prisma.js';
import { docker } from '../lib/docker.js';
import { logActivity } from './audit.service.js';
import { createHash } from 'node:crypto';

// ── Register SSH key ─────────────────────────────────
export async function registerSshKey(params: {
  userId: string;
  deviceId: string;
  publicKey: string;
  label: string;
  ipAddress?: string;
}) {
  // Compute fingerprint from public key
  const fingerprint = computeKeyFingerprint(params.publicKey);

  // Check for duplicate
  const existing = await prisma.sshKey.findUnique({
    where: { userId_fingerprint: { userId: params.userId, fingerprint } },
  });
  if (existing) {
    if (!existing.isActive) {
      // Reactivate
      await prisma.sshKey.update({
        where: { id: existing.id },
        data: { isActive: true, deviceId: params.deviceId },
      });
    }
    return existing;
  }

  const sshKey = await prisma.sshKey.create({
    data: {
      userId: params.userId,
      deviceId: params.deviceId,
      publicKey: params.publicKey,
      fingerprint,
      label: params.label,
    },
  });

  // Inject key into container
  await injectKeyToContainer(params.userId);

  await logActivity({
    userId: params.userId,
    activityType: 'SSH_KEY_ADD',
    description: `SSH key "${params.label}" added`,
    ipAddress: params.ipAddress,
    metadata: { fingerprint, deviceId: params.deviceId },
  });

  return sshKey;
}

// ── Revoke SSH key ───────────────────────────────────
export async function revokeSshKey(params: {
  keyId: string;
  userId: string;
  ipAddress?: string;
}) {
  const key = await prisma.sshKey.update({
    where: { id: params.keyId },
    data: { isActive: false },
  });

  // Update container authorized_keys
  await injectKeyToContainer(key.userId);

  await logActivity({
    userId: params.userId,
    activityType: 'SSH_KEY_REVOKE',
    description: `SSH key "${key.label}" revoked`,
    ipAddress: params.ipAddress,
    metadata: { fingerprint: key.fingerprint },
  });

  return key;
}

// ── List user's SSH keys ─────────────────────────────
export async function listSshKeys(userId: string) {
  return prisma.sshKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Inject all active keys into container ────────────
export async function injectKeyToContainer(userId: string) {
  const container = await prisma.container.findUnique({ where: { userId } });
  if (!container?.containerId) return;

  const keys = await prisma.sshKey.findMany({
    where: { userId, isActive: true },
  });
  const authorizedKeys = keys.map(k => k.publicKey).join('\n');

  try {
    const dockerContainer = docker.getContainer(container.containerId);
    const exec = await dockerContainer.exec({
      Cmd: ['sh', '-c', `mkdir -p /home/devuser/.ssh && echo '${authorizedKeys}' > /home/devuser/.ssh/authorized_keys && chmod 600 /home/devuser/.ssh/authorized_keys && chown devuser:devuser /home/devuser/.ssh/authorized_keys`],
      AttachStdout: true,
      AttachStderr: true,
    });
    await exec.start({});
  } catch (err) {
    console.error(`Failed to inject SSH keys for user ${userId}:`, err);
  }
}

// ── Get connection info ──────────────────────────────
export async function getConnectionInfo(userId: string) {
  const container = await prisma.container.findUnique({
    where: { userId },
    include: { user: { select: { username: true } } },
  });
  if (!container) throw new Error('No container found');

  const hostname = process.env.DDNS_HOST || 'dioramarketing.iptime.org';

  return {
    host: hostname,
    port: container.sshPort,
    username: 'devuser',
    containerName: container.name,
    status: container.status,
    sshCommand: `ssh -p ${container.sshPort} devuser@${hostname}`,
    vsCodeUri: `vscode://vscode-remote/ssh-remote+devuser@${hostname}:${container.sshPort}/workspace`,
  };
}

// ── Helpers ──────────────────────────────────────────
function computeKeyFingerprint(publicKey: string): string {
  const parts = publicKey.trim().split(' ');
  const keyData = parts.length >= 2 ? parts[1] : parts[0];
  const hash = createHash('sha256').update(Buffer.from(keyData, 'base64')).digest('base64');
  return `SHA256:${hash.replace(/=+$/, '')}`;
}
