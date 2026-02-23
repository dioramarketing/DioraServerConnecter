// ============================================================
// Server
// ============================================================
export const API_PORT = 4000;
export const API_PREFIX = '/api/v1';

// ============================================================
// Docker / Container
// ============================================================
export const DOCKER_NETWORK = 'dsc-network';
export const CONTAINER_IMAGE = 'dsc-devenv:latest';
export const CONTAINER_PREFIX = 'dsc-user-';
export const SSH_PORT_MIN = 2230;
export const SSH_PORT_MAX = 2250;

// ============================================================
// Resource Defaults
// ============================================================
export const DEFAULT_CPU_CORES = 2;
export const DEFAULT_MEMORY_MB = 8192;
export const DEFAULT_STORAGE_SSD_GB = 50;
export const DEFAULT_STORAGE_HDD_GB = 200;
export const MAX_CONTAINERS = 20;

// ============================================================
// Auth
// ============================================================
export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY = '7d';
export const ACCESS_TOKEN_EXPIRY_SEC = 15 * 60;
export const REFRESH_TOKEN_EXPIRY_SEC = 7 * 24 * 60 * 60;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MIN = 15;
export const TWO_FA_CODE_LENGTH = 6;
export const TWO_FA_CODE_EXPIRY_MIN = 5;
export const TWO_FA_MAX_ATTEMPTS = 3;

// ============================================================
// Rate Limiting
// ============================================================
export const RATE_LIMIT_MAX = 100;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const AUTH_RATE_LIMIT_MAX = 5;
export const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;

// ============================================================
// Network
// ============================================================
export const INTERNAL_NETWORK_PREFIX = '192.168.0.';

// ============================================================
// Storage Paths
// ============================================================
export const SSD_CONTAINERS_PATH = '/data/ssd/containers';
export const HDD_CONTAINERS_PATH = '/data/hdd/containers';
export const HDD_SHARED_PATH = '/data/hdd/shared';

// ============================================================
// Redis Keys
// ============================================================
export const REDIS_PREFIX = 'dsc:';
export const REDIS_SESSION_PREFIX = 'dsc:session:';
export const REDIS_BLACKLIST_PREFIX = 'dsc:blacklist:';
export const REDIS_METRICS_PREFIX = 'dsc:metrics:';
export const REDIS_2FA_PREFIX = 'dsc:2fa:';
