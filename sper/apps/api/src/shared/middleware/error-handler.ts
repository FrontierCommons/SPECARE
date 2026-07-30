import type { FastifyReply, FastifyRequest, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { DomainError, type DomainErrorCode } from '../errors';

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/**
 * Central error handler. Domain errors map to their status; zod validation
 * failures become 422; everything else is a 500 with no internal leakage.
 */
export function errorHandler(
  error: FastifyError | DomainError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof DomainError) {
    reply
      .code(STATUS_BY_CODE[error.code])
      .send({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    reply.code(422).send({
      error: {
        code: 'VALIDATION',
        message: 'Request validation failed',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  // Fastify's own validation (schema) errors carry statusCode.
  const status = (error as FastifyError).statusCode;
  if (status && status >= 400 && status < 500) {
    reply.code(status).send({ error: { code: 'VALIDATION', message: error.message } });
    return;
  }

  request.log.error(error);
  reply.code(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
