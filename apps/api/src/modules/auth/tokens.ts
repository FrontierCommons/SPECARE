import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import type { AuthTokens } from '@sper/shared-types';

export interface AccessClaims {
  sub: string; // user id
  type: 'access';
}
export interface RefreshClaims {
  sub: string;
  type: 'refresh';
}
export interface MagicClaims {
  sub: string; // email (pre-account) or user id
  type: 'magic';
}
export interface ResetClaims {
  sub: string; // user id
  type: 'reset';
}

function signAccess(userId: string): string {
  return jwt.sign({ sub: userId, type: 'access' } satisfies AccessClaims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies RefreshClaims, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as SignOptions);
}

export function issueTokens(userId: string): AuthTokens {
  return {
    access_token: signAccess(userId),
    refresh_token: signRefresh(userId),
    expires_in: ttlToSeconds(env.JWT_ACCESS_TTL),
  };
}

export function verifyAccess(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
  if (decoded.type !== 'access') throw new Error('Wrong token type');
  return decoded;
}

/** Refresh rotation: verify the presented refresh token, return the subject. */
export function verifyRefresh(token: string): RefreshClaims {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims;
  if (decoded.type !== 'refresh') throw new Error('Wrong token type');
  return decoded;
}

export function signMagicLink(subject: string): string {
  return jwt.sign({ sub: subject, type: 'magic' } satisfies MagicClaims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.MAGIC_LINK_TTL,
  } as SignOptions);
}

export function verifyMagicLink(token: string): MagicClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as MagicClaims;
  if (decoded.type !== 'magic') throw new Error('Wrong token type');
  return decoded;
}

// Deliberately its own claim type (not reused from magic-link) so a link that
// only proves email ownership can never also be replayed to change a password.
export function signPasswordReset(userId: string): string {
  return jwt.sign({ sub: userId, type: 'reset' } satisfies ResetClaims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.MAGIC_LINK_TTL,
  } as SignOptions);
}

export function verifyPasswordReset(token: string): ResetClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as ResetClaims;
  if (decoded.type !== 'reset') throw new Error('Wrong token type');
  return decoded;
}

/** Convert a "15m"/"30d"/"3600" style string to seconds for expires_in. */
function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return n;
  }
}
