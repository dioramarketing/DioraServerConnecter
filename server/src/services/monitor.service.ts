import si from 'systeminformation';
import { docker } from '../lib/docker.js';
import { prisma } from '../lib/prisma.js';
import type { MetricsPayload } from '@dsc/shared';

// ── Host metrics ─────────────────────────────────────
export async function getHostMetrics(): Promise<MetricsPayload['host']> {
  const [cpu, mem, disks, net] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
  ]);

  const relevantMounts = disks.filter(d =>
    d.mount === '/' || d.mount === '/data/ssd' || d.mount === '/data/hdd' || d.mount === '/backup'
  );

  const totalRx = net.reduce((sum, n) => sum + (n.rx_sec || 0), 0);
  const totalTx = net.reduce((sum, n) => sum + (n.tx_sec || 0), 0);

  return {
    cpuPercent: Math.round(cpu.currentLoad * 100) / 100,
    memoryUsedMb: Math.round((mem.used / 1024 / 1024) * 100) / 100,
    memoryTotalMb: Math.round((mem.total / 1024 / 1024) * 100) / 100,
    diskUsage: relevantMounts.map(d => ({
      mount: d.mount,
      usedGb: Math.round((d.used / 1024 / 1024 / 1024) * 100) / 100,
      totalGb: Math.round((d.size / 1024 / 1024 / 1024) * 100) / 100,
    })),
    networkRxBytesPerSec: Math.round(totalRx),
    networkTxBytesPerSec: Math.round(totalTx),
  };
}

// ── Container metrics ────────────────────────────────
export async function getContainerMetrics(): Promise<MetricsPayload['containers']> {
  const containers = await prisma.container.findMany({
    where: { containerId: { not: null } },
    include: { user: { select: { id: true } } },
  });

  const results = await Promise.allSettled(
    containers.map(async (c) => {
      if (!c.containerId) return null;
      try {
        const dockerContainer = docker.getContainer(c.containerId);
        const stats = await dockerContainer.stats({ stream: false });

        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

        const memUsed = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);
        const memLimit = stats.memory_stats.limit;

        const netRx = Object.values(stats.networks || {}).reduce((sum: number, n: any) => sum + (n.rx_bytes || 0), 0);
        const netTx = Object.values(stats.networks || {}).reduce((sum: number, n: any) => sum + (n.tx_bytes || 0), 0);

        return {
          containerId: c.id,
          userId: c.userId,
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          memoryUsedMb: Math.round(memUsed / 1024 / 1024),
          memoryLimitMb: Math.round(memLimit / 1024 / 1024),
          networkRxBytes: netRx,
          networkTxBytes: netTx,
        };
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof getContainerMetrics>>[number]>> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value);
}

// ── Combined metrics ─────────────────────────────────
export async function getAllMetrics(): Promise<MetricsPayload> {
  const [host, containers] = await Promise.all([
    getHostMetrics(),
    getContainerMetrics(),
  ]);
  return { host, containers };
}

// ── Record usage snapshot (for history) ──────────────
export async function recordUsageSnapshot() {
  const containers = await prisma.container.findMany({
    where: { containerId: { not: null }, status: 'RUNNING' },
  });

  for (const c of containers) {
    if (!c.containerId) continue;
    try {
      const dockerContainer = docker.getContainer(c.containerId);
      const stats = await dockerContainer.stats({ stream: false });

      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;
      const memUsed = stats.memory_stats.usage - (stats.memory_stats.stats?.cache || 0);

      await prisma.resourceUsage.create({
        data: {
          containerId: c.id,
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          memoryUsedMb: Math.round(memUsed / 1024 / 1024),
          storageSsdUsedGb: 0, // TODO: implement storage tracking
          storageHddUsedGb: 0,
          networkRxBytes: BigInt(0),
          networkTxBytes: BigInt(0),
        },
      });
    } catch {
      // Container may be stopped
    }
  }
}
