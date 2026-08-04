import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccess } from '../../modules/auth/tokens';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

/**
 * Prehandler that requires a valid bearer access token and attaches
 * `request.userId`. Register per-route (public auth routes skip it).
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } });
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const claims = verifyAccess(token);
    request.userId = claims.sub;
  } catch {
    await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}

/** Helper to read the authenticated user id or throw a 500-worthy error. */
export function currentUserId(request: FastifyRequest): string {
  if (!request.userId) throw new Error('requireAuth preHandler not applied to this route');
  return request.userId;
}
