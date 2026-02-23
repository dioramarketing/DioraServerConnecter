import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { SSD_UPDATES_PATH, API_PREFIX } from '@dsc/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

interface PlatformInfo {
  url: string;
  signature: string;
}

interface Release {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, PlatformInfo>;
}

interface ReleasesJson {
  releases: Release[];
}

const RELEASES_FILE = join(SSD_UPDATES_PATH, 'releases.json');
const FILES_DIR = join(SSD_UPDATES_PATH, 'files');

// Detect platform from filename (supports both Tauri v1 .tar.gz and v2 direct formats)
function detectPlatform(filename: string): string | null {
  const lower = filename.toLowerCase();
  // Windows: .nsis.zip (v1) or .exe (v2)
  if (lower.endsWith('.nsis.zip') || lower.endsWith('.exe')) return 'windows-x86_64';
  // macOS: .app.tar.gz (v1) or .dmg (v2)
  if (lower.endsWith('.app.tar.gz') || lower.endsWith('.dmg')) {
    if (lower.includes('aarch64') || lower.includes('arm')) return 'darwin-aarch64';
    return 'darwin-x86_64';
  }
  // Linux: .AppImage.tar.gz (v1) or .AppImage (v2)
  if (lower.endsWith('.appimage.tar.gz') || lower.endsWith('.appimage')) return 'linux-x86_64';
  return null;
}

async function loadReleases(): Promise<ReleasesJson> {
  if (!existsSync(RELEASES_FILE)) return { releases: [] };
  const data = await readFile(RELEASES_FILE, 'utf-8');
  return JSON.parse(data);
}

async function saveReleases(data: ReleasesJson): Promise<void> {
  await mkdir(SSD_UPDATES_PATH, { recursive: true });
  await writeFile(RELEASES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export default async function adminReleaseRoutes(fastify: FastifyInstance) {
  // All routes require admin auth
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', authorize('ADMIN'));

  // List all releases
  fastify.get('/', async (_request, reply) => {
    const { releases } = await loadReleases();
    return reply.send({ success: true, data: releases });
  });

  // Create new release (multipart upload)
  fastify.post('/', async (request, reply) => {
    const parts = request.parts();
    let version = '';
    let notes = '';
    const platforms: Record<string, PlatformInfo> = {};
    const savedFiles: { path: string; filename: string; platform: string | null }[] = [];
    const sigContents: Record<string, string> = {};

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'version') version = part.value as string;
        if (part.fieldname === 'notes') notes = part.value as string;
      } else if (part.type === 'file') {
        if (!version) {
          return reply.code(400).send({ success: false, error: 'version field must come before files' });
        }

        const versionDir = join(FILES_DIR, version);
        await mkdir(versionDir, { recursive: true });

        const filename = part.filename;
        const filePath = join(versionDir, filename);

        if (filename.endsWith('.sig')) {
          // Read signature content into memory
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          sigContents[filename] = Buffer.concat(chunks).toString('utf-8').trim();
        } else {
          // Save update file to disk
          await pipeline(part.file, createWriteStream(filePath));
          const platform = detectPlatform(filename);
          savedFiles.push({ path: filePath, filename, platform });
        }
      }
    }

    if (!version) {
      return reply.code(400).send({ success: false, error: 'version is required' });
    }

    // Build download base URL
    const host = request.headers.host || 'localhost:4000';
    const protocol = request.protocol || 'http';
    const baseUrl = `${protocol}://${host}${API_PREFIX}/updates/download/${version}`;

    // Match files with their signatures
    for (const file of savedFiles) {
      if (!file.platform) continue;

      const sigFilename = `${file.filename}.sig`;
      const signature = sigContents[sigFilename] || '';

      platforms[file.platform] = {
        url: `${baseUrl}/${file.filename}`,
        signature,
      };
    }

    // Add to releases.json
    const releasesData = await loadReleases();

    // Remove existing release with same version if any
    releasesData.releases = releasesData.releases.filter(r => r.version !== version);

    releasesData.releases.push({
      version,
      notes,
      pub_date: new Date().toISOString(),
      platforms,
    });

    await saveReleases(releasesData);

    return reply.code(201).send({
      success: true,
      data: { version, platforms: Object.keys(platforms) },
    });
  });

  // Delete a release
  fastify.delete('/:version', async (request, reply) => {
    const { version } = request.params as { version: string };

    if (version.includes('..')) {
      return reply.code(400).send({ success: false, error: 'Invalid version' });
    }

    const releasesData = await loadReleases();
    const before = releasesData.releases.length;
    releasesData.releases = releasesData.releases.filter(r => r.version !== version);

    if (releasesData.releases.length === before) {
      return reply.code(404).send({ success: false, error: 'Release not found' });
    }

    await saveReleases(releasesData);

    // Remove files
    const versionDir = join(FILES_DIR, version);
    if (existsSync(versionDir)) {
      await rm(versionDir, { recursive: true, force: true });
    }

    return reply.send({ success: true, message: `Release ${version} deleted` });
  });
}
