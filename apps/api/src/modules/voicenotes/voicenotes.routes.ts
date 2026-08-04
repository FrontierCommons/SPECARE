import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { voiceNoteService, VOICE_NOTE_MAX_DURATION_MS } from './voicenotes.service';
import { authRepo } from '../auth/auth.repo';
import { db } from '../../config/db';
import { requireAuth, currentUserId } from '../../shared/middleware/auth';
import { NotFoundError } from '../../shared/errors';

const idParam = z.object({ id: z.string().uuid() });
const noteIdParam = z.object({ id: z.string().uuid(), noteId: z.string().uuid() });
const sendSchema = z.object({
  audio_base64: z.string().min(1).max(2_000_000),
  mime_type: z.string().min(1).max(100),
  duration_ms: z.number().int().positive().max(VOICE_NOTE_MAX_DURATION_MS),
});

export async function voiceNoteRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/checkins/:id/voice-notes', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = sendSchema.parse(req.body);
    const senderId = currentUserId(req);

    const sender = await authRepo.findById(db, senderId);
    if (!sender) throw new NotFoundError('User not found');

    const voiceNote = await voiceNoteService.send({
      checkinId: id,
      senderId,
      senderName: sender.name,
      audioBase64: body.audio_base64,
      mimeType: body.mime_type,
      durationMs: body.duration_ms,
    });
    return reply.code(201).send({ voice_note: voiceNote });
  });

  app.get('/checkins/:id/voice-notes', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const voiceNotes = await voiceNoteService.list(id, currentUserId(req));
    return reply.code(200).send({ voice_notes: voiceNotes });
  });

  app.post('/checkins/:id/voice-notes/:noteId/received', async (req, reply) => {
    const { id, noteId } = noteIdParam.parse(req.params);
    await voiceNoteService.markReceived(id, noteId, currentUserId(req));
    return reply.code(200).send({ ok: true });
  });
}
