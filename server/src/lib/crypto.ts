import { randomBytes, createHash } from 'node:crypto';

export function generateRandomCode(length: number): string {
  const chars = '0123456789';
  let result = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(48).toString('base64url');
}
