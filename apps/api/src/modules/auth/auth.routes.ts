import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  timezone: z.string().min(1),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const magicSchema = z.object({ email: z.string().email() });
const magicVerifySchema = z.object({ token: z.string().min(1) });
const refreshSchema = z.object({ refresh_token: z.string().min(1) });
const resetRequestSchema = z.object({ email: z.string().email() });
const resetConfirmSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);
    return reply.code(201).send(result);
  });

  app.post('/auth/login', async (req, reply) => {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    return reply.code(200).send(result);
  });

  app.post('/auth/magic-link', async (req, reply) => {
    const { email } = magicSchema.parse(req.body);
    const { token } = await authService.issueMagicLink(email);
    // Never reveal whether the email exists. Delivery of `token` is handled by
    // the email layer; logged in dev for now.
    if (token) {
      req.log.info({ email }, '[magic-link] token issued (would be emailed)');
    }
    return reply.code(202).send();
  });

  app.post('/auth/magic-link/verify', async (req, reply) => {
    const { token } = magicVerifySchema.parse(req.body);
    const result = await authService.verifyMagicLink(token);
    return reply.code(200).send(result);
  });

  app.post('/auth/refresh', async (req, reply) => {
    const { refresh_token } = refreshSchema.parse(req.body);
    const tokens = await authService.refresh(refresh_token);
    return reply.code(200).send({ tokens });
  });

  app.post('/auth/reset-password/request', async (req, reply) => {
    const { email } = resetRequestSchema.parse(req.body);
    // Never reveal whether the email exists; same contract as the magic link.
    const { token } = await authService.requestPasswordReset(email);
    if (token) {
      req.log.info({ email }, '[reset-password] token issued (would be emailed)');
    }
    return reply.code(202).send();
  });

  app.post('/auth/reset-password/confirm', async (req, reply) => {
    const { token, password } = resetConfirmSchema.parse(req.body);
    const result = await authService.confirmPasswordReset(token, password);
    return reply.code(200).send(result);
  });
}
