#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# DioraServerConnecter Container Entrypoint
# ============================================================

echo "[entrypoint] Starting container initialization..."

# ------------------------------------------------------------
# 1. Set up SSH authorized_keys from environment variable
# ------------------------------------------------------------
if [ -n "${SSH_PUBLIC_KEY:-}" ]; then
    echo "[entrypoint] Setting up SSH authorized_keys from SSH_PUBLIC_KEY env var"
    echo "${SSH_PUBLIC_KEY}" > /home/devuser/.ssh/authorized_keys
    chmod 600 /home/devuser/.ssh/authorized_keys
    chown devuser:devuser /home/devuser/.ssh/authorized_keys
    echo "[entrypoint] SSH public key installed successfully"
else
    echo "[entrypoint] WARNING: SSH_PUBLIC_KEY not set. SSH login will not be possible unless authorized_keys is mounted."
fi

# ------------------------------------------------------------
# 2. Generate host keys if missing (first run)
# ------------------------------------------------------------
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    echo "[entrypoint] Generating SSH host keys..."
    ssh-keygen -A
fi

# ------------------------------------------------------------
# 3. Fix ownership on workspace directories
# ------------------------------------------------------------
echo "[entrypoint] Fixing permissions on workspace directories..."
chown devuser:devuser /workspace /storage || true
chown devuser:devuser /shared 2>/dev/null || echo "[entrypoint] /shared is read-only, skipping chown"

# ------------------------------------------------------------
# 4. Start supervisord (manages sshd)
# ------------------------------------------------------------
echo "[entrypoint] Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
