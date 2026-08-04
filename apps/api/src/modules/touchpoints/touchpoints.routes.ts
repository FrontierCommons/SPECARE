import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { touchpointService } from './touchpoints.service';
import { authRepo } from '../auth/auth.repo';
import { db } from '../../config/db';
import { requireAuth, currentUserId } from '../../shared/middleware/auth';
import { NotFoundError } from '../../shared/errors';
import { TOUCHPOINT_TYPES, type TouchpointType } from '@sper/shared-types';

const typeEnum = z.enum(TOUCHPOINT_TYPES as unknown as [string, ...string[]]);
const logSchema = z.object({ type: typeEnum });
const idParam = z.object({ id: z.string().uuid() });

export async function touchpointRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/checkins/:id/touchpoints', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { type } = logSchema.parse(req.body);
    const responderId = currentUserId(req);

    const responder = await authRepo.findById(db, responderId);
    if (!responder) throw new NotFoundError('User not found');

    const touchpoint = await touchpointService.log({
      checkinId: id,
      responderId,
      responderName: responder.name,
      type: type as TouchpointType,
    });
    return reply.code(201).send({ touchpoint });
  });

  app.get('/checkins/:id/touchpoints', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const touchpoints = await touchpointService.list(id, currentUserId(req));
    return reply.code(200).send({ touchpoints });
  });
}
