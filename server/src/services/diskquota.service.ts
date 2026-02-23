import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { SSD_CONTAINERS_PATH, HDD_CONTAINERS_PATH } from '@dsc/shared';

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 120_000 }).trim();
}

function isMounted(mountPath: string): boolean {
  try {
    const output = run(`mount | grep " ${mountPath} "`);
    return output.length > 0;
  } catch {
    return false;
  }
}

/** Create a disk image, format it as ext4, and mount it via loop device */
export function createAndMountImage(imgPath: string, mountPath: string, sizeGb: number): void {
  if (sizeGb <= 0) return;

  const imgDir = imgPath.substring(0, imgPath.lastIndexOf('/'));
  run(`sudo mkdir -p "${imgDir}" "${mountPath}"`);

  if (!existsSync(imgPath)) {
    // Check if mountPath has existing data to migrate
    let hasData = false;
    try { hasData = existsSync(mountPath) && readdirSync(mountPath).length > 0; } catch { /* */ }
    const tmpDir = hasData ? `${mountPath}.migrate-tmp` : null;

    if (hasData && tmpDir) {
      run(`sudo mkdir -p "${tmpDir}"`);
      run(`sudo cp -a "${mountPath}/." "${tmpDir}/"`);
    }

    // Sparse file — doesn't consume full space until written
    run(`sudo truncate -s ${sizeGb}G "${imgPath}"`);
    run(`sudo mkfs.ext4 -q -m 0 -F "${imgPath}"`);

    if (!isMounted(mountPath)) {
      run(`sudo mount -o loop "${imgPath}" "${mountPath}"`);
    }

    // Restore migrated data
    if (hasData && tmpDir) {
      run(`sudo cp -a "${tmpDir}/." "${mountPath}/"`);
      run(`sudo rm -rf "${tmpDir}"`);
    }
  } else {
    if (!isMounted(mountPath)) {
      run(`sudo mount -o loop "${imgPath}" "${mountPath}"`);
    }
  }

  // Ensure container user (uid 1000) owns mount root
  run(`sudo chown 1000:1000 "${mountPath}"`);
}

/** Unmount a storage image */
export function unmountImage(mountPath: string): void {
  if (isMounted(mountPath)) {
    run(`sudo umount -l "${mountPath}"`);
  }
}

/** Resize an existing image. Growing works online; shrinking requires unmount. */
export function resizeImage(imgPath: string, mountPath: string, newSizeGb: number): void {
  if (!existsSync(imgPath)) return;

  if (newSizeGb <= 0) {
    unmountImage(mountPath);
    run(`sudo rm -f "${imgPath}"`);
    return;
  }

  const currentBytes = parseInt(run(`stat -c%s "${imgPath}"`), 10);
  const currentGb = Math.round(currentBytes / (1024 * 1024 * 1024));
  if (newSizeGb === currentGb) return;

  const wasMounted = isMounted(mountPath);

  if (newSizeGb > currentGb) {
    // Grow — can be done online
    run(`sudo truncate -s ${newSizeGb}G "${imgPath}"`);
    if (wasMounted) {
      const loopDev = run(`losetup -j "${imgPath}" | head -1 | cut -d: -f1`);
      if (loopDev) {
        run(`sudo losetup -c "${loopDev}"`);
        run(`sudo resize2fs "${loopDev}"`);
      }
    } else {
      run(`sudo e2fsck -f -y "${imgPath}" 2>/dev/null || true`);
      run(`sudo resize2fs "${imgPath}"`);
    }
  } else {
    // Shrink — must unmount
    if (wasMounted) unmountImage(mountPath);
    run(`sudo e2fsck -f -y "${imgPath}" 2>/dev/null || true`);
    run(`sudo resize2fs "${imgPath}" ${newSizeGb}G`);
    run(`sudo truncate -s ${newSizeGb}G "${imgPath}"`);
    if (wasMounted) {
      run(`sudo mount -o loop "${imgPath}" "${mountPath}"`);
    }
  }
}

/** Ensure image is mounted (for container start / server reboot) */
export function ensureMounted(imgPath: string, mountPath: string): void {
  if (!existsSync(imgPath)) return;
  run(`sudo mkdir -p "${mountPath}"`);
  if (!isMounted(mountPath)) {
    run(`sudo mount -o loop "${imgPath}" "${mountPath}"`);
  }
}

/** Remove image and mountpoint entirely */
export function removeImage(imgPath: string, mountPath: string): void {
  unmountImage(mountPath);
  if (existsSync(imgPath)) run(`sudo rm -f "${imgPath}"`);
}

/** Get paths for a user's storage volumes */
export function getUserStoragePaths(username: string) {
  return {
    ssdImg: `${SSD_CONTAINERS_PATH}/${username}/workspace.img`,
    ssdMount: `${SSD_CONTAINERS_PATH}/${username}/workspace`,
    hddImg: `${HDD_CONTAINERS_PATH}/${username}/storage.img`,
    hddMount: `${HDD_CONTAINERS_PATH}/${username}/storage`,
  };
}

/** Get actual disk usage of a mounted volume */
export function getUsage(mountPath: string): { usedBytes: number; totalBytes: number } {
  if (!isMounted(mountPath)) return { usedBytes: 0, totalBytes: 0 };
  try {
    const line = run(`df -k "${mountPath}" | tail -1`);
    const parts = line.split(/\s+/);
    return {
      totalBytes: parseInt(parts[1], 10) * 1024,
      usedBytes: parseInt(parts[2], 10) * 1024,
    };
  } catch {
    return { usedBytes: 0, totalBytes: 0 };
  }
}
