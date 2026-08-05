import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deviceRepo } from './devices.repo';
import { authRepo } from '../auth/auth.repo';
import { toUserDTO } from '../auth/auth.service';
import { db } from '../../config/db';
import { requireAuth, currentUserId } from '../../shared/middleware/auth';
import {
  DEVICE_PLATFORMS,
  CHECKIN_FREQUENCIES,
  type DevicePlatform,
  type CheckInFrequency,
} from '@sper/shared-types';
import { NotFoundError } from '../../shared/errors';

const platformEnum = z.enum(DEVICE_PLATFORMS as unknown as [string, ...string[]]);
const registerSchema = z.object({ token: z.string().min(1), platform: platformEnum });
const checkinFrequencyEnum = z.enum(CHECKIN_FREQUENCIES as unknown as [string, ...string[]]);
const updateProfileSchema = z.object({
  notifications_paused: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  checkin_frequency: checkinFrequencyEnum.optional(),
  // A resized (~256px) JPEG data URI — capped well under the base64
  // voice-note ceiling since, unlike a voice note, this rides along on
  // every member-list and circle response, not just a single fetch.
  avatar_url: z.string().max(300_000).nullable().optional(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/users/me', async (req) => {
    const user = await authRepo.findById(db, currentUserId(req));
    if (!user) throw new NotFoundError('Account no longer exists');
    return { user: toUserDTO(user) };
  });

  app.patch('/users/me', async (req) => {
    const body = updateProfileSchema.parse(req.body);
    const user = await authRepo.updateProfile(db, currentUserId(req), {
      ...(body.notifications_paused !== undefined
        ? { notificationsPaused: body.notifications_paused }
        : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.checkin_frequency !== undefined
        ? { checkinFrequency: body.checkin_frequency as CheckInFrequency }
        : {}),
      ...(body.avatar_url !== undefined ? { avatarUrl: body.avatar_url } : {}),
    });
    return { user: toUserDTO(user) };
  });

  app.delete('/users/me', async (req, reply) => {
    await authRepo.deleteUser(db, currentUserId(req));
    return reply.code(200).send({ ok: true });
  });

  app.post('/devices', async (req, reply) => {
    const { token, platform } = registerSchema.parse(req.body);
    const row = await deviceRepo.register(currentUserId(req), token, platform as DevicePlatform);
    return reply.code(201).send({ device: { id: row.id, platform: row.platform } });
  });
}
