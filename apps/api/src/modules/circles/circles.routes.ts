import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { circleService } from './circles.service';
import { requireAuth, currentUserId } from '../../shared/middleware/auth';

const createSchema = z.object({ name: z.string().min(1) });
const joinSchema = z
  .object({ code: z.string().length(6).optional(), invite_token: z.string().min(1).optional() })
  .refine((v) => v.code || v.invite_token, { message: 'code or invite_token required' });
const inviteSchema = z.object({ email: z.string().email().optional() });
const idParam = z.object({ id: z.string().uuid() });

export async function circleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/circles/mine', async (req, reply) => {
    const circles = await circleService.mine(currentUserId(req));
    return reply.code(200).send({ circles });
  });

  app.post('/circles', async (req, reply) => {
    const { name } = createSchema.parse(req.body);
    const circle = await circleService.create(name, currentUserId(req));
    return reply.code(201).send({ circle });
  });

  app.post('/circles/join', async (req, reply) => {
    const body = joinSchema.parse(req.body);
    const result = await circleService.join(
      { ...(body.code ? { code: body.code } : {}), ...(body.invite_token ? { inviteToken: body.invite_token } : {}) },
      currentUserId(req),
    );
    return reply.code(200).send(result);
  });

  app.post('/circles/:id/invites', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { email } = inviteSchema.parse(req.body ?? {});
    const invite = await circleService.createInvite(id, currentUserId(req), email);
    return reply.code(201).send(invite);
  });

  app.post('/circles/:id/pact/agree', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await circleService.agreePact(id, currentUserId(req));
    return reply.code(200).send({ ok: true });
  });

  app.get('/circles/:id/members', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const members = await circleService.members(id, currentUserId(req));
    return reply.code(200).send({ members });
  });

  app.post('/circles/:id/leave', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await circleService.leave(id, currentUserId(req));
    return reply.code(200).send({ ok: true });
  });
}
