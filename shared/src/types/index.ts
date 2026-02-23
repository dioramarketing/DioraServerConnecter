// ============================================================
// User
// ============================================================
export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Device
// ============================================================
export type DeviceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export interface Device {
  id: string;
  userId: string;
  fingerprint: string;
  name: string;
  os: string;
  status: DeviceStatus;
  approvedBy: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

// ============================================================
// Container
// ============================================================
export type ContainerStatus = 'CREATING' | 'RUNNING' | 'STOPPED' | 'ERROR' | 'REBUILDING';

export interface Container {
  id: string;
  userId: string;
  containerId: string | null;
  name: string;
  sshPort: number;
  status: ContainerStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Resource
// ============================================================
export interface ResourceAllocation {
  id: string;
  userId: string;
  cpuCores: number;
  memoryMb: number;
  storageSsdGb: number;
  storageHddGb: number;
}

export interface ResourceUsage {
  id: string;
  containerId: string;
  cpuPercent: number;
  memoryUsedMb: number;
  storageSsdUsedGb: number;
  storageHddUsedGb: number;
  networkRxBytes: number;
  networkTxBytes: number;
  recordedAt: string;
}

// ============================================================
// SSH Key
// ============================================================
export interface SshKey {
  id: string;
  userId: string;
  deviceId: string;
  publicKey: string;
  fingerprint: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================================
// Session
// ============================================================
export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  refreshTokenHash: string;
  ipAddress: string;
  userAgent: string | null;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
}

// ============================================================
// Activity Log
// ============================================================
export type ActivityType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'REGISTER'
  | 'DEVICE_REGISTER'
  | 'DEVICE_APPROVE'
  | 'DEVICE_REJECT'
  | 'DEVICE_REVOKE'
  | 'CONTAINER_CREATE'
  | 'CONTAINER_START'
  | 'CONTAINER_STOP'
  | 'CONTAINER_REBUILD'
  | 'CONTAINER_REMOVE'
  | 'SSH_KEY_ADD'
  | 'SSH_KEY_REVOKE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_SUSPEND'
  | 'USER_DELETE'
  | 'RESOURCE_UPDATE'
  | 'SHARED_FOLDER_CREATE'
  | 'SHARED_FOLDER_UPDATE'
  | 'TWO_FA_SENT'
  | 'TWO_FA_VERIFIED'
  | 'TWO_FA_FAILED'
  | 'ADMIN_ACTION';

export interface ActivityLog {
  id: string;
  userId: string | null;
  activityType: ActivityType;
  description: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ============================================================
// Shared Folder
// ============================================================
export type FolderPermission = 'READ' | 'READWRITE';

export interface SharedFolder {
  id: string;
  name: string;
  path: string;
  createdBy: string;
  createdAt: string;
}

export interface SharedFolderMember {
  id: string;
  folderId: string;
  userId: string;
  permission: FolderPermission;
}

// ============================================================
// Notification
// ============================================================
export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'DEVICE_APPROVAL' | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================================
// Message (Chat)
// ============================================================
export interface Message {
  id: string;
  senderId: string;
  recipientId: string | null;
  channelId: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
}

// ============================================================
// API Request/Response Types
// ============================================================
export interface LoginRequest {
  username: string;
  password: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceOs: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  requiresTwoFa: boolean;
}

export interface TwoFaVerifyRequest {
  code: string;
  sessionId: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface CreateContainerRequest {
  userId: string;
  cpuCores?: number;
  memoryMb?: number;
  storageSsdGb?: number;
  storageHddGb?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================
// WebSocket Messages
// ============================================================
export type WsMessageType =
  | 'METRICS_UPDATE'
  | 'CONTAINER_STATUS'
  | 'NOTIFICATION'
  | 'CHAT_MESSAGE'
  | 'PING'
  | 'PONG';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  timestamp: string;
}

export interface MetricsPayload {
  host: {
    cpuPercent: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    diskUsage: { mount: string; usedGb: number; totalGb: number }[];
    networkRxBytesPerSec: number;
    networkTxBytesPerSec: number;
  };
  containers: {
    containerId: string;
    userId: string;
    cpuPercent: number;
    memoryUsedMb: number;
    memoryLimitMb: number;
    networkRxBytes: number;
    networkTxBytes: number;
  }[];
}
