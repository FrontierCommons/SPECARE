/**
 * Domain-level errors. Services throw these; the HTTP layer (Phase 4)
 * maps `.code` to a status. Keeping them transport-agnostic means the
 * domain core stays testable without Fastify.
 */

export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'UNAUTHORIZED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found', details?: unknown) {
    super('NOT_FOUND', message, details);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Not permitted', details?: unknown) {
    super('FORBIDDEN', message, details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflict', details?: unknown) {
    super('CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Invalid input', details?: unknown) {
    super('VALIDATION', message, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Not authenticated', details?: unknown) {
    super('UNAUTHORIZED', message, details);
    this.name = 'UnauthorizedError';
  }
}
