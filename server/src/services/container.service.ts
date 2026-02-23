import {
  CONTAINER_IMAGE,
  CONTAINER_PREFIX,
  DOCKER_NETWORK,
  SSH_PORT_MIN,
  SSH_PORT_MAX,
  DEFAULT_CPU_CORES,
  DEFAULT_MEMORY_MB,
  DEFAULT_STORAGE_SSD_GB,
  DEFAULT_STORAGE_HDD_GB,
  HDD_SHARED_PATH,
} from '@dsc/shared';
import { docker } from '../lib/docker.js';
import { prisma } from '../lib/prisma.js';
import { logActivity } from './audit.service.js';
import { mkdirSync, existsSync } from 'node:fs';
import {
  createAndMountImage,
  unmountImage,
  ensureMounted,
  removeImage,
  resizeImage,
  getUserStoragePaths,
} from './diskquota.service.js';

// ── Create container ─────────────────────────────────
export async function createContainer(params: {
  userId: string;
  cpuCores?: number;
  memoryMb?: number;
  storageSsdGb?: number;
  storageHddGb?: number;
  sshPublicKey?: string;
  ipAddress?: string;
}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });

  // Check existing container
  const existing = await prisma.container.findUnique({ where: { userId: params.userId } });
  if (existing) throw new Error('User already has a container');

  // Allocate SSH port
  const sshPort = await allocateSshPort();
  const containerName = `${CONTAINER_PREFIX}${user.username}`;

  // Resource limits
  const cpuCores = params.cpuCores || DEFAULT_CPU_CORES;
  const memoryMb = params.memoryMb || DEFAULT_MEMORY_MB;
  const storageSsdGb = params.storageSsdGb ?? DEFAULT_STORAGE_SSD_GB;
  const storageHddGb = params.storageHddGb ?? DEFAULT_STORAGE_HDD_GB;

  // Storage paths
  const paths = getUserStoragePaths(user.username);
  ensureDir(HDD_SHARED_PATH);

  // Create and mount storage images (skips if 0GB)
  createAndMountImage(paths.ssdImg, paths.ssdMount, storageSsdGb);
  createAndMountImage(paths.hddImg, paths.hddMount, storageHddGb);

  // Create container record first
  const containerRecord = await prisma.container.create({
    data: {
      userId: params.userId,
      name: containerName,
      sshPort,
      status: 'CREATING',
    },
  });

  // Update resource allocation
  await prisma.resourceAllocation.upsert({
    where: { userId: params.userId },
    update: { cpuCores, memoryMb, storageSsdGb, storageHddGb },
    create: { userId: params.userId, cpuCores, memoryMb, storageSsdGb, storageHddGb },
  });

  try {
    // Build bind mounts: only include volumes with >0 allocation
    const binds: string[] = [];
    if (storageSsdGb > 0) binds.push(`${paths.ssdMount}:/workspace`);
    if (storageHddGb > 0) binds.push(`${paths.hddMount}:/storage`);
    binds.push(`${HDD_SHARED_PATH}:/shared:ro`);

    // Create Docker container
    const container = await docker.createContainer({
      Image: CONTAINER_IMAGE,
      name: containerName,
      Hostname: user.username,
      Env: [
        `SSH_PUBLIC_KEY=${params.sshPublicKey || ''}`,
        `USERNAME=${user.username}`,
      ],
      ExposedPorts: { '22/tcp': {} },
      HostConfig: {
        PortBindings: {
          '22/tcp': [{ HostPort: String(sshPort) }],
        },
        Binds: binds,
        NanoCpus: cpuCores * 1e9,
        Memory: memoryMb * 1024 * 1024,
        MemorySwap: memoryMb * 1024 * 1024,
        PidsLimit: 500,
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'],
        CapAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID', 'NET_BIND_SERVICE'],
        RestartPolicy: { Name: 'unless-stopped' },
        NetworkMode: DOCKER_NETWORK,
      },
    });

    await container.start();

    await prisma.container.update({
      where: { id: containerRecord.id },
      data: { containerId: container.id, status: 'RUNNING' },
    });

    await logActivity({
      userId: params.userId,
      activityType: 'CONTAINER_CREATE',
      description: `Container "${containerName}" created (CPU: ${cpuCores}, RAM: ${memoryMb}MB, SSD: ${storageSsdGb}GB, HDD: ${storageHddGb}GB, SSH: ${sshPort})`,
      ipAddress: params.ipAddress,
    });

    return { ...containerRecord, containerId: container.id, status: 'RUNNING' as const };
  } catch (err) {
    await prisma.container.update({
      where: { id: containerRecord.id },
      data: { status: 'ERROR' },
    });
    throw err;
  }
}

// ── Start container ──────────────────────────────────
export async function startContainer(userId: string, ipAddress?: string) {
  const record = await prisma.container.findUniqueOrThrow({
    where: { userId },
    include: { user: { select: { username: true } } },
  });
  if (!record.containerId) throw new Error('Container not initialized');

  // Re-mount storage images (may have been lost after reboot)
  const paths = getUserStoragePaths(record.user.username);
  ensureMounted(paths.ssdImg, paths.ssdMount);
  ensureMounted(paths.hddImg, paths.hddMount);

  const container = docker.getContainer(record.containerId);
  await container.start();

  await prisma.container.update({
    where: { id: record.id },
    data: { status: 'RUNNING' },
  });

  await logActivity({
    userId,
    activityType: 'CONTAINER_START',
    description: `Container "${record.name}" started`,
    ipAddress,
  });
}

// ── Stop container ───────────────────────────────────
export async function stopContainer(userId: string, ipAddress?: string) {
  const record = await prisma.container.findUniqueOrThrow({ where: { userId } });
  if (!record.containerId) throw new Error('Container not initialized');

  const container = docker.getContainer(record.containerId);
  await container.stop();

  await prisma.container.update({
    where: { id: record.id },
    data: { status: 'STOPPED' },
  });

  await logActivity({
    userId,
    activityType: 'CONTAINER_STOP',
    description: `Container "${record.name}" stopped`,
    ipAddress,
  });
}

// ── Restart container ────────────────────────────────
export async function restartContainer(userId: string, ipAddress?: string) {
  const record = await prisma.container.findUniqueOrThrow({ where: { userId } });
  if (!record.containerId) throw new Error('Container not initialized');

  const container = docker.getContainer(record.containerId);
  await container.restart();

  await prisma.container.update({
    where: { id: record.id },
    data: { status: 'RUNNING' },
  });
}

// ── Remove container ─────────────────────────────────
export async function removeContainer(userId: string, ipAddress?: string) {
  const record = await prisma.container.findUniqueOrThrow({
    where: { userId },
    include: { user: { select: { username: true } } },
  });

  if (record.containerId) {
    try {
      const container = docker.getContainer(record.containerId);
      try { await container.stop(); } catch { /* may already be stopped */ }
      await container.remove({ force: true });
    } catch {
      // Container may not exist in Docker
    }
  }

  // Unmount storage images (keep the files so data isn't lost)
  const paths = getUserStoragePaths(record.user.username);
  unmountImage(paths.ssdMount);
  unmountImage(paths.hddMount);

  await prisma.container.delete({ where: { id: record.id } });

  await logActivity({
    userId,
    activityType: 'CONTAINER_REMOVE',
    description: `Container "${record.name}" removed`,
    ipAddress,
  });
}

// ── Rebuild container ────────────────────────────────
export async function rebuildContainer(userId: string, ipAddress?: string) {
  const record = await prisma.container.findUniqueOrThrow({
    where: { userId },
    include: { user: true },
  });

  await prisma.container.update({
    where: { id: record.id },
    data: { status: 'REBUILDING' },
  });

  const sshKeys = await prisma.sshKey.findMany({
    where: { userId, isActive: true },
  });
  const sshPublicKey = sshKeys.map(k => k.publicKey).join('\n');
  const resources = await prisma.resourceAllocation.findUnique({ where: { userId } });

  // Remove old Docker container (keep storage images intact)
  if (record.containerId) {
    try {
      const container = docker.getContainer(record.containerId);
      try { await container.stop(); } catch { /* */ }
      await container.remove({ force: true });
    } catch { /* */ }
  }

  await prisma.container.delete({ where: { id: record.id } });

  // Recreate with same storage (images already exist, createAndMountImage will just re-mount)
  await createContainer({
    userId,
    cpuCores: resources?.cpuCores,
    memoryMb: resources?.memoryMb,
    storageSsdGb: resources?.storageSsdGb,
    storageHddGb: resources?.storageHddGb,
    sshPublicKey,
    ipAddress,
  });

  await logActivity({
    userId,
    activityType: 'CONTAINER_REBUILD',
    description: `Container "${record.name}" rebuilt`,
    ipAddress,
  });
}

// ── Update storage quota (live resize) ───────────────
export async function updateStorageQuota(userId: string, storageSsdGb: number, storageHddGb: number) {
  const record = await prisma.container.findUnique({
    where: { userId },
    include: { user: { select: { username: true } } },
  });
  if (!record) return; // No container, just update DB (done by caller)

  const paths = getUserStoragePaths(record.user.username);

  // Resize SSD
  if (storageSsdGb > 0) {
    if (!existsSync(paths.ssdImg)) {
      createAndMountImage(paths.ssdImg, paths.ssdMount, storageSsdGb);
    } else {
      resizeImage(paths.ssdImg, paths.ssdMount, storageSsdGb);
    }
  } else {
    removeImage(paths.ssdImg, paths.ssdMount);
  }

  // Resize HDD
  if (storageHddGb > 0) {
    if (!existsSync(paths.hddImg)) {
      createAndMountImage(paths.hddImg, paths.hddMount, storageHddGb);
    } else {
      resizeImage(paths.hddImg, paths.hddMount, storageHddGb);
    }
  } else {
    removeImage(paths.hddImg, paths.hddMount);
  }
}

// ── Get container status ─────────────────────────────
export async function getContainerStatus(userId: string) {
  const record = await prisma.container.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, username: true, email: true } },
    },
  });
  if (!record) return null;

  let dockerStatus: string | null = null;
  if (record.containerId) {
    try {
      const container = docker.getContainer(record.containerId);
      const info = await container.inspect();
      dockerStatus = info.State.Status;
    } catch {
      dockerStatus = 'not_found';
    }
  }

  return { ...record, dockerStatus };
}

// ── List all containers ──────────────────────────────
export async function listContainers() {
  return prisma.container.findMany({
    include: {
      user: { select: { id: true, username: true, email: true, role: true } },
      resourceUsages: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
    },
  });
}

// ── Container stats ──────────────────────────────────
export async function getContainerStats(containerId: string) {
  try {
    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });
    return stats;
  } catch {
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────
async function allocateSshPort(): Promise<number> {
  const usedPorts = await prisma.container.findMany({
    select: { sshPort: true },
  });
  const used = new Set(usedPorts.map(p => p.sshPort));

  for (let port = SSH_PORT_MIN; port <= SSH_PORT_MAX; port++) {
    if (!used.has(port)) return port;
  }
  throw new Error('No available SSH ports');
}

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}
