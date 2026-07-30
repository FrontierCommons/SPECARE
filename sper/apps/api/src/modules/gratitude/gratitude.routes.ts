import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { gratitudeService } from './gratitude.service';
import { requireAuth, currentUserId } from '../../shared/middleware/auth';

const idParam = z.object({ id: z.string().uuid() });

export async function gratitudeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/checkins/:id/gratitude', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const result = await gratitudeService.send(id, currentUserId(req));
    return reply.code(201).send(result);
  });
}
