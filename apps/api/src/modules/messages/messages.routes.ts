import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { messageService, MESSAGE_MAX_LENGTH } from './messages.service';
import { authRepo } from '../auth/auth.repo';
import { db } from '../../config/db';
import { requireAuth, currentUserId } from '../../shared/middleware/auth';
import { NotFoundError } from '../../shared/errors';

const idParam = z.object({ id: z.string().uuid() });
const messageIdParam = z.object({ id: z.string().uuid(), messageId: z.string().uuid() });
const sendSchema = z.object({
  body: z.string().min(1).max(MESSAGE_MAX_LENGTH),
});

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/checkins/:id/messages', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = sendSchema.parse(req.body);
    const senderId = currentUserId(req);

    const sender = await authRepo.findById(db, senderId);
    if (!sender) throw new NotFoundError('User not found');

    const message = await messageService.send({
      checkinId: id,
      senderId,
      senderName: sender.name,
      body: body.body,
    });
    return reply.code(201).send({ message });
  });

  app.get('/checkins/:id/messages', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const messages = await messageService.list(id, currentUserId(req));
    return reply.code(200).send({ messages });
  });

  app.post('/checkins/:id/messages/:messageId/received', async (req, reply) => {
    const { id, messageId } = messageIdParam.parse(req.params);
    await messageService.markReceived(id, messageId, currentUserId(req));
    return reply.code(200).send({ ok: true });
  });
}
