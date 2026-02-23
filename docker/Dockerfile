FROM ubuntu:24.04

LABEL maintainer="diorama"
LABEL description="DioraServerConnecter dev container"

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Seoul

# ============================================================
# Layer 1: System packages (changes least frequently)
# ============================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        wget \
        gnupg \
        git \
        vim \
        nano \
        htop \
        tmux \
        build-essential \
        openssh-server \
        supervisor \
        sudo \
        locales \
        tzdata \
        python3.12 \
        python3-pip \
        python3.12-venv \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# ============================================================
# Layer 2: Node.js 20 via nodesource
# ============================================================
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# Layer 3: Global npm packages (Claude Code CLI)
# ============================================================
RUN npm install -g @anthropic-ai/claude-code

# ============================================================
# Layer 4: SSH server configuration
# ============================================================
RUN mkdir -p /run/sshd

COPY sshd_config /etc/ssh/sshd_config

# ============================================================
# Layer 5: Non-root user with sudo access
# ============================================================
RUN groupadd devuser 2>/dev/null || true \
    && useradd -m -g devuser -s /bin/bash devuser 2>/dev/null || true \
    && echo "devuser ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/devuser \
    && chmod 0440 /etc/sudoers.d/devuser

# Prepare SSH directory for devuser
RUN mkdir -p /home/devuser/.ssh \
    && chmod 700 /home/devuser/.ssh \
    && chown devuser:devuser /home/devuser/.ssh

# ============================================================
# Layer 6: Workspace directories
# ============================================================
RUN mkdir -p /workspace /storage /shared \
    && chown devuser:devuser /workspace /storage /shared

# ============================================================
# Layer 7: Supervisord configuration
# ============================================================
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ============================================================
# Layer 8: Entrypoint
# ============================================================
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose SSH port
EXPOSE 22

# Volumes for persistent data
VOLUME ["/workspace", "/storage", "/shared"]

ENTRYPOINT ["/entrypoint.sh"]
