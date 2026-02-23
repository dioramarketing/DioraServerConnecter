import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  ACCESS_TOKEN_EXPIRY_SEC,
  REFRESH_TOKEN_EXPIRY_SEC,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MIN,
  TWO_FA_CODE_LENGTH,
  TWO_FA_CODE_EXPIRY_MIN,
  TWO_FA_MAX_ATTEMPTS,
  INTERNAL_NETWORK_PREFIX,
  REDIS_BLACKLIST_PREFIX,
  REDIS_2FA_PREFIX,
} from '@dsc/shared';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { generateRandomCode, hashToken, generateToken } from '../lib/crypto.js';
import { logActivity } from './audit.service.js';
import { sendTwoFaCode } from './email.service.js';

const accessSecret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

export interface TokenPayload extends JWTPayload {
  sub: string;
  username: string;
  role: string;
  deviceId: string;
}

// ── Token generation ─────────────────────────────────
export async function generateAccessToken(payload: {
  userId: string;
  username: string;
  role: string;
  deviceId: string;
}): Promise<string> {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    deviceId: payload.deviceId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(accessSecret);
}

export async function generateRefreshToken(payload: {
  userId: string;
  username: string;
  role: string;
  deviceId: string;
}): Promise<string> {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    deviceId: payload.deviceId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const blacklisted = await redis.get(`${REDIS_BLACKLIST_PREFIX}${token}`);
  if (blacklisted) throw new Error('Token has been revoked');

  const { payload } = await jwtVerify(token, accessSecret);
  return payload as TokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret);
  return payload as TokenPayload;
}

export async function blacklistToken(token: string, expirySec: number): Promise<void> {
  await redis.setex(`${REDIS_BLACKLIST_PREFIX}${token}`, expirySec, '1');
}

// ── Password ─────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Login ────────────────────────────────────────────
export async function login(params: {
  username: string;
  password: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceOs: string;
  ipAddress: string;
  userAgent?: string;
}) {
  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user || user.status !== 'ACTIVE') {
    await logActivity({
      activityType: 'LOGIN_FAILED',
      description: `Login failed: user "${params.username}" not found or inactive`,
      ipAddress: params.ipAddress,
    });
    throw new Error('Invalid credentials');
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error(`Account locked. Try again after ${user.lockedUntil.toISOString()}`);
  }

  // Verify password
  const valid = await verifyPassword(params.password, user.passwordHash);
  if (!valid) {
    const newCount = user.failedLoginCount + 1;
    const update: Record<string, unknown> = { failedLoginCount: newCount };
    if (newCount >= MAX_LOGIN_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MIN * 60 * 1000);
    }
    await prisma.user.update({ where: { id: user.id }, data: update });
    await logActivity({
      userId: user.id,
      activityType: 'LOGIN_FAILED',
      description: `Login failed: wrong password (attempt ${newCount})`,
      ipAddress: params.ipAddress,
    });
    throw new Error('Invalid credentials');
  }

  // Reset failed count
  if (user.failedLoginCount > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  // Find or create device
  let device = await prisma.device.findUnique({
    where: { userId_fingerprint: { userId: user.id, fingerprint: params.deviceFingerprint } },
  });

  if (!device) {
    device = await prisma.device.create({
      data: {
        userId: user.id,
        fingerprint: params.deviceFingerprint,
        name: params.deviceName,
        os: params.deviceOs,
        status: 'PENDING',
      },
    });
    await logActivity({
      userId: user.id,
      activityType: 'DEVICE_REGISTER',
      description: `New device registered: ${params.deviceName} (${params.deviceOs})`,
      ipAddress: params.ipAddress,
      metadata: { deviceId: device.id, fingerprint: params.deviceFingerprint },
    });
  }

  // Check device approval
  if (device.status !== 'APPROVED') {
    // Admin's first device auto-approved
    if (user.role === 'ADMIN' && device.status === 'PENDING') {
      device = await prisma.device.update({
        where: { id: device.id },
        data: { status: 'APPROVED', approvedBy: user.id },
      });
    } else if (device.status === 'PENDING') {
      return { requiresDeviceApproval: true, deviceId: device.id };
    } else {
      throw new Error('Device has been rejected or revoked');
    }
  }

  // Update last seen
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

  // Check if 2FA required (external network)
  const isInternal = params.ipAddress.startsWith(INTERNAL_NETWORK_PREFIX) || params.ipAddress === '127.0.0.1';
  if (!isInternal) {
    const code = generateRandomCode(TWO_FA_CODE_LENGTH);
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        code,
        ipAddress: params.ipAddress,
        expiresAt: new Date(Date.now() + TWO_FA_CODE_EXPIRY_MIN * 60 * 1000),
      },
    });
    // Store pending 2FA session in Redis
    const twoFaSessionId = generateToken();
    await redis.setex(
      `${REDIS_2FA_PREFIX}${twoFaSessionId}`,
      TWO_FA_CODE_EXPIRY_MIN * 60,
      JSON.stringify({ userId: user.id, deviceId: device.id, code }),
    );
    try {
      await sendTwoFaCode(user.email, code);
    } catch {
      // Log but don't fail - the code is still in Redis
      console.error('Failed to send 2FA email');
    }
    await logActivity({
      userId: user.id,
      activityType: 'TWO_FA_SENT',
      description: '2FA code sent for external network login',
      ipAddress: params.ipAddress,
    });
    return { requiresTwoFa: true, twoFaSessionId, email: maskEmail(user.email) };
  }

  // Generate tokens
  return issueTokens(user, device, params.ipAddress, params.userAgent);
}

// ── 2FA Verify ───────────────────────────────────────
export async function verifyTwoFa(params: {
  sessionId: string;
  code: string;
  ipAddress: string;
  userAgent?: string;
}) {
  const raw = await redis.get(`${REDIS_2FA_PREFIX}${params.sessionId}`);
  if (!raw) throw new Error('2FA session expired');

  const session = JSON.parse(raw) as { userId: string; deviceId: string; code: string; attempts?: number };
  const attempts = (session.attempts || 0) + 1;

  if (attempts > TWO_FA_MAX_ATTEMPTS) {
    await redis.del(`${REDIS_2FA_PREFIX}${params.sessionId}`);
    await logActivity({
      userId: session.userId,
      activityType: 'TWO_FA_FAILED',
      description: '2FA max attempts exceeded',
      ipAddress: params.ipAddress,
    });
    throw new Error('Too many attempts');
  }

  if (session.code !== params.code) {
    session.attempts = attempts;
    await redis.setex(`${REDIS_2FA_PREFIX}${params.sessionId}`, TWO_FA_CODE_EXPIRY_MIN * 60, JSON.stringify(session));
    await logActivity({
      userId: session.userId,
      activityType: 'TWO_FA_FAILED',
      description: `2FA verification failed (attempt ${attempts})`,
      ipAddress: params.ipAddress,
    });
    throw new Error('Invalid code');
  }

  await redis.del(`${REDIS_2FA_PREFIX}${params.sessionId}`);
  await logActivity({
    userId: session.userId,
    activityType: 'TWO_FA_VERIFIED',
    description: '2FA verification successful',
    ipAddress: params.ipAddress,
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const device = await prisma.device.findUniqueOrThrow({ where: { id: session.deviceId } });

  return issueTokens(user, device, params.ipAddress, params.userAgent);
}

// ── Refresh ──────────────────────────────────────────
export async function refreshTokens(params: {
  refreshToken: string;
  ipAddress: string;
  userAgent?: string;
}) {
  const payload = await verifyRefreshToken(params.refreshToken);
  const userId = payload.sub!;
  const deviceId = payload.deviceId;

  const tokenHash = hashToken(params.refreshToken);
  const session = await prisma.session.findFirst({
    where: { userId, deviceId, refreshTokenHash: tokenHash, isRevoked: false },
  });
  if (!session) throw new Error('Invalid refresh token');
  if (session.expiresAt < new Date()) throw new Error('Refresh token expired');

  // Revoke old session (rotation)
  await prisma.session.update({ where: { id: session.id }, data: { isRevoked: true } });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const device = await prisma.device.findUniqueOrThrow({ where: { id: deviceId } });

  return issueTokens(user, device, params.ipAddress, params.userAgent);
}

// ── Logout ───────────────────────────────────────────
export async function logout(params: {
  userId: string;
  accessToken: string;
  ipAddress: string;
}) {
  // Blacklist access token
  await blacklistToken(params.accessToken, ACCESS_TOKEN_EXPIRY_SEC);

  // Revoke all sessions for user (or specific device)
  await prisma.session.updateMany({
    where: { userId: params.userId, isRevoked: false },
    data: { isRevoked: true },
  });

  await logActivity({
    userId: params.userId,
    activityType: 'LOGOUT',
    description: 'User logged out',
    ipAddress: params.ipAddress,
  });
}

// ── Register (admin only) ────────────────────────────
export async function registerUser(params: {
  username: string;
  email: string;
  password: string;
  role?: 'ADMIN' | 'USER';
  createdByUserId: string;
  ipAddress: string;
}) {
  const passwordHash = await hashPassword(params.password);
  const user = await prisma.user.create({
    data: {
      username: params.username,
      email: params.email,
      passwordHash,
      role: params.role || 'USER',
    },
  });

  // Create default resource allocation
  await prisma.resourceAllocation.create({
    data: { userId: user.id },
  });

  await logActivity({
    userId: params.createdByUserId,
    activityType: 'USER_CREATE',
    description: `Created user "${params.username}" with role ${params.role || 'USER'}`,
    ipAddress: params.ipAddress,
    metadata: { newUserId: user.id },
  });

  return user;
}

// ── Helpers ──────────────────────────────────────────
async function issueTokens(
  user: { id: string; username: string; role: string },
  device: { id: string },
  ipAddress: string,
  userAgent?: string,
) {
  const tokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    deviceId: device.id,
  };

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(tokenPayload),
    generateRefreshToken(tokenPayload),
  ]);

  // Save session
  await prisma.session.create({
    data: {
      userId: user.id,
      deviceId: device.id,
      refreshTokenHash: hashToken(refreshToken),
      ipAddress,
      userAgent: userAgent || null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SEC * 1000),
    },
  });

  await logActivity({
    userId: user.id,
    activityType: 'LOGIN',
    description: 'User logged in',
    ipAddress,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : local[0] + '*';
  return `${masked}@${domain}`;
}
