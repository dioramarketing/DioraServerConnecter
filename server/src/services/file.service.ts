import { docker } from '../lib/docker.js';
import { prisma } from '../lib/prisma.js';
import { Readable } from 'node:stream';

// Sanitize path to prevent directory traversal
function sanitizePath(inputPath: string): string {
  // Resolve to absolute, remove .. and normalize
  const parts = inputPath.split('/').filter(p => p !== '' && p !== '.' && p !== '..');
  return '/' + parts.join('/');
}

async function getContainerForUser(userId: string) {
  const record = await prisma.container.findUnique({ where: { userId } });
  if (!record?.containerId) throw new Error('No container assigned');
  if (record.status !== 'RUNNING') throw new Error('Container is not running');
  return docker.getContainer(record.containerId);
}

async function execInContainer(container: any, cmd: string[]): Promise<{ stdout: string; exitCode: number }> {
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', async () => {
      const output = Buffer.concat(chunks).toString('utf-8');
      // Demux: Docker multiplexes stdout/stderr with 8-byte header frames
      // For simplicity, just clean up control chars
      const cleaned = output.replace(/[\x00-\x08\x0e-\x1f]/g, '').trim();
      try {
        const info = await exec.inspect();
        resolve({ stdout: cleaned, exitCode: info.ExitCode ?? 0 });
      } catch {
        resolve({ stdout: cleaned, exitCode: 0 });
      }
    });
    stream.on('error', reject);
  });
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory' | 'link' | 'other';
  size: number;
  modified: string;
  permissions: string;
  owner: string;
  group: string;
}

export async function listDirectory(userId: string, dirPath: string): Promise<FileEntry[]> {
  const container = await getContainerForUser(userId);
  const safePath = sanitizePath(dirPath);

  // Use stat-based format for reliable parsing
  const { stdout, exitCode } = await execInContainer(container, [
    '/bin/sh', '-c',
    `ls -la --time-style=full-iso "${safePath}" 2>/dev/null || echo "ERROR_DIR_NOT_FOUND"`,
  ]);

  if (stdout.includes('ERROR_DIR_NOT_FOUND') || exitCode !== 0) {
    throw new Error(`Directory not found: ${safePath}`);
  }

  const lines = stdout.split('\n').filter(l => l.trim() && !l.startsWith('total'));
  const entries: FileEntry[] = [];

  for (const line of lines) {
    // Parse ls -la output: permissions links owner group size date time timezone name
    const match = line.match(
      /^([drwxlsStT-]{10,})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+\S+\s+(.+)$/
    );
    if (!match) continue;

    const [, permissions, owner, group, sizeStr, date, time, name] = match;
    const cleanName = name.replace(/ -> .+$/, ''); // Remove symlink target
    if (cleanName === '.' || cleanName === '..') continue;

    let type: FileEntry['type'] = 'file';
    if (permissions.startsWith('d')) type = 'directory';
    else if (permissions.startsWith('l')) type = 'link';
    else if (!permissions.startsWith('-')) type = 'other';

    entries.push({
      name: cleanName,
      type,
      size: parseInt(sizeStr, 10),
      modified: `${date}T${time}`,
      permissions,
      owner,
      group,
    });
  }

  return entries.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFile(userId: string, filePath: string): Promise<Buffer> {
  const container = await getContainerForUser(userId);
  const safePath = sanitizePath(filePath);

  // Use docker cp via archive
  const stream = await container.getArchive({ path: safePath });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function writeFile(userId: string, filePath: string, content: Buffer): Promise<void> {
  const container = await getContainerForUser(userId);
  const safePath = sanitizePath(filePath);
  const dirPath = safePath.substring(0, safePath.lastIndexOf('/')) || '/';

  // Write via exec with base64 to avoid encoding issues
  const b64 = content.toString('base64');
  const { exitCode } = await execInContainer(container, [
    '/bin/sh', '-c',
    `echo '${b64}' | base64 -d > "${safePath}"`,
  ]);
  if (exitCode !== 0) throw new Error('Failed to write file');
}

export async function createDirectory(userId: string, dirPath: string): Promise<void> {
  const container = await getContainerForUser(userId);
  const safePath = sanitizePath(dirPath);
  const { exitCode } = await execInContainer(container, ['mkdir', '-p', safePath]);
  if (exitCode !== 0) throw new Error('Failed to create directory');
}

export async function deleteItem(userId: string, itemPath: string): Promise<void> {
  const container = await getContainerForUser(userId);
  const safePath = sanitizePath(itemPath);
  if (safePath === '/' || safePath === '/workspace') throw new Error('Cannot delete root paths');
  const { exitCode } = await execInContainer(container, ['rm', '-rf', safePath]);
  if (exitCode !== 0) throw new Error('Failed to delete item');
}

export async function renameItem(userId: string, oldPath: string, newPath: string): Promise<void> {
  const container = await getContainerForUser(userId);
  const safeOld = sanitizePath(oldPath);
  const safeNew = sanitizePath(newPath);
  const { exitCode } = await execInContainer(container, ['mv', safeOld, safeNew]);
  if (exitCode !== 0) throw new Error('Failed to rename/move item');
}
