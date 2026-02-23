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
  SSD_CONTAINERS_PATH,
  HDD_CONTAINERS_PATH,
  HDD_SHARED_PATH,
} from '@dsc/shared';
import { docker } from '../lib/docker.js';
import { prisma } from '../lib/prisma.js';
import { logActivity } from './audit.service.js';
import { mkdirSync, existsSync } from 'node:fs';

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

  // Ensure directories exist
  const ssdPath = `${SSD_CONTAINERS_PATH}/${user.username}/workspace`;
  const hddPath = `${HDD_CONTAINERS_PATH}/${user.username}/storage`;
  ensureDir(ssdPath);
  ensureDir(hddPath);
  ensureDir(HDD_SHARED_PATH);

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
    update: {
      cpuCores,
      memoryMb,
      storageSsdGb: params.storageSsdGb || DEFAULT_STORAGE_SSD_GB,
      storageHddGb: params.storageHddGb || DEFAULT_STORAGE_HDD_GB,
    },
    create: {
      userId: params.userId,
      cpuCores,
      memoryMb,
      storageSsdGb: params.storageSsdGb || DEFAULT_STORAGE_SSD_GB,
      storageHddGb: params.storageHddGb || DEFAULT_STORAGE_HDD_GB,
    },
  });

  try {
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
        Binds: [
          `${ssdPath}:/workspace`,
          `${hddPath}:/storage`,
          `${HDD_SHARED_PATH}:/shared:ro`,
        ],
        // Resource limits
        NanoCpus: cpuCores * 1e9,
        Memory: memoryMb * 1024 * 1024,
        MemorySwap: memoryMb * 1024 * 1024, // No swap
        PidsLimit: 500,
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'],
        CapAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID', 'NET_BIND_SERVICE'],
        RestartPolicy: { Name: 'unless-stopped' },
        NetworkMode: DOCKER_NETWORK,
      },
    });

    // Start container
    await container.start();

    // Update record with Docker container ID
    await prisma.container.update({
      where: { id: containerRecord.id },
      data: {
        containerId: container.id,
        status: 'RUNNING',
      },
    });

    await logActivity({
      userId: params.userId,
      activityType: 'CONTAINER_CREATE',
      description: `Container "${containerName}" created (CPU: ${cpuCores}, RAM: ${memoryMb}MB, SSH port: ${sshPort})`,
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
  const record = await prisma.container.findUniqueOrThrow({ where: { userId } });
  if (!record.containerId) throw new Error('Container not initialized');

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
  const record = await prisma.container.findUniqueOrThrow({ where: { userId } });

  if (record.containerId) {
    try {
      const container = docker.getContainer(record.containerId);
      try { await container.stop(); } catch { /* may already be stopped */ }
      await container.remove({ force: true });
    } catch {
      // Container may not exist in Docker
    }
  }

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

  // Get SSH keys for the user
  const sshKeys = await prisma.sshKey.findMany({
    where: { userId, isActive: true },
  });
  const sshPublicKey = sshKeys.map(k => k.publicKey).join('\n');

  // Get resource allocation
  const resources = await prisma.resourceAllocation.findUnique({ where: { userId } });

  // Remove old container
  if (record.containerId) {
    try {
      const container = docker.getContainer(record.containerId);
      try { await container.stop(); } catch { /* */ }
      await container.remove({ force: true });
    } catch { /* */ }
  }

  await prisma.container.delete({ where: { id: record.id } });

  // Recreate
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
