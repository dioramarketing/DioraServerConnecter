import type { FastifyInstance } from 'fastify';
import { existsSync, createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SSD_UPDATES_PATH } from '@dsc/shared';

interface Release {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, { url: string; signature: string }>;
}

interface ReleasesJson {
  releases: Release[];
}

const RELEASES_FILE = join(SSD_UPDATES_PATH, 'releases.json');

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function loadReleases(): Promise<ReleasesJson> {
  if (!existsSync(RELEASES_FILE)) return { releases: [] };
  const data = await readFile(RELEASES_FILE, 'utf-8');
  return JSON.parse(data);
}

export default async function updateRoutes(fastify: FastifyInstance) {
  // Tauri-compatible update check
  // GET /check/:target/:current_version
  fastify.get('/check/:target/:current_version', async (request, reply) => {
    const { target, current_version } = request.params as { target: string; current_version: string };

    const { releases } = await loadReleases();
    if (releases.length === 0) {
      return reply.code(204).send();
    }

    // Find latest release that has a build for this target
    const sorted = [...releases].sort((a, b) => compareSemver(b.version, a.version));
    const latest = sorted.find(r => r.platforms[target]);

    if (!latest || compareSemver(latest.version, current_version) <= 0) {
      return reply.code(204).send();
    }

    const platform = latest.platforms[target];
    return reply.send({
      version: latest.version,
      notes: latest.notes,
      pub_date: latest.pub_date,
      url: platform.url,
      signature: platform.signature,
    });
  });

  // Download update file
  // GET /download/:version/:filename
  fastify.get('/download/:version/:filename', async (request, reply) => {
    const { version, filename } = request.params as { version: string; filename: string };

    // Sanitize path components
    if (version.includes('..') || filename.includes('..')) {
      return reply.code(400).send({ success: false, error: 'Invalid path' });
    }

    const filePath = join(SSD_UPDATES_PATH, 'files', version, filename);
    if (!existsSync(filePath)) {
      return reply.code(404).send({ success: false, error: 'File not found' });
    }

    const fileStat = await stat(filePath);
    const stream = createReadStream(filePath);

    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', fileStat.size)
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(stream);
  });
}
