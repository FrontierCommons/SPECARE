import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { checkInService } from './checkins.service';
import { requireAuth, currentUserId } from '../../shared/middleware/auth';
import { STATE_LEVELS, type StateLevel } from '@sper/shared-types';

const stateEnum = z.enum(STATE_LEVELS as unknown as [string, ...string[]]);

const submitSchema = z.object({
  circle_id: z.string().uuid(),
  spiritual_state: stateEnum,
  physical_state: stateEnum,
  emotional_state: stateEnum,
  vocational_state: stateEnum,
  relational_state: stateEnum,
  optional_note: z.string().max(140).optional(),
});

const idParam = z.object({ id: z.string().uuid() });

export async function checkinRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/checkins', async (req, reply) => {
    const body = submitSchema.parse(req.body);
    const result = await checkInService.submit({
      userId: currentUserId(req),
      circleId: body.circle_id,
      spiritual_state: body.spiritual_state as StateLevel,
      physical_state: body.physical_state as StateLevel,
      emotional_state: body.emotional_state as StateLevel,
      vocational_state: body.vocational_state as StateLevel,
      relational_state: body.relational_state as StateLevel,
      ...(body.optional_note !== undefined ? { optional_note: body.optional_note } : {}),
    });
    return reply.code(201).send(result);
  });

  app.get('/circles/:id/radar', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const radar = await checkInService.radar(id, currentUserId(req));
    return reply.code(200).send({ radar });
  });

  app.get('/circles/:id/care-cards', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const care_cards = await checkInService.careCards(id, currentUserId(req));
    return reply.code(200).send({ care_cards });
  });
}
