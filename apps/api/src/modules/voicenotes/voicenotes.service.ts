import { db, type DB } from '../../config/db';
import { VoiceNoteRepo, voiceNoteRepo } from './voicenotes.repo';
import { touchpointRepo } from '../touchpoints/touchpoints.repo';
import { gratitudeRepo } from '../gratitude/gratitude.repo';
import { toVoiceNoteDTO } from '../../shared/mappers';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import type { VoiceNoteDTO } from '@sper/shared-types';

export const VOICE_NOTE_MAX_DURATION_MS = 30_000;

/**
 * Delivery implements this to nudge the target that a voice note is
 * waiting. No-op default so the domain runs standalone.
 */
export interface VoiceNoteDispatcher {
  notifyVoiceNote(input: { targetUserId: string; senderName: string; checkinId: string }): Promise<void>;
}

const noopDispatcher: VoiceNoteDispatcher = {
  async notifyVoiceNote() {
    /* wired in delivery/wire.ts */
  },
};

export interface SendVoiceNoteInput {
  checkinId: string;
  senderId: string;
  senderName: string;
  audioBase64: string;
  mimeType: string;
  durationMs: number;
}

export class VoiceNoteService {
  constructor(
    private readonly repo: VoiceNoteRepo = voiceNoteRepo,
    private dispatcher: VoiceNoteDispatcher = noopDispatcher,
    private readonly database: DB = db,
  ) {}

  setDispatcher(dispatcher: VoiceNoteDispatcher): void {
    this.dispatcher = dispatcher;
  }

  /**
   * A responder records for the check-in's author. Writes the note and a
   * VoiceNoteSent touchpoint in one transaction (so "already reached out"
   * stays accurate regardless of which action produced it), then nudges
   * the target post-commit.
   */
  async send(input: SendVoiceNoteInput): Promise<VoiceNoteDTO> {
    if (input.durationMs <= 0 || input.durationMs > VOICE_NOTE_MAX_DURATION_MS) {
      throw new ValidationError(`Voice notes must be under ${VOICE_NOTE_MAX_DURATION_MS / 1000}s`);
    }
    if (!input.audioBase64) {
      throw new ValidationError('Missing audio data');
    }

    const result = await this.database.transaction(async (tx) => {
      const ctx = await this.repo.checkinContext(tx, input.checkinId);
      if (!ctx) throw new NotFoundError('Check-in not found');

      const isMember = await this.repo.isMember(tx, ctx.circleId, input.senderId);
      if (!isMember) throw new ForbiddenError('Not a member of this circle');
      if (ctx.targetUserId === input.senderId) {
        throw new ForbiddenError('Cannot send a voice note to your own check-in');
      }

      const inserted = await this.repo.insert(tx, {
        checkinId: input.checkinId,
        senderId: input.senderId,
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
        durationMs: input.durationMs,
      });

      await touchpointRepo.insert(tx, {
        checkinId: input.checkinId,
        responderId: input.senderId,
        type: 'VoiceNoteSent',
      });

      return { inserted, targetUserId: ctx.targetUserId };
    });

    await this.dispatcher.notifyVoiceNote({
      targetUserId: result.targetUserId,
      senderName: input.senderName,
      checkinId: input.checkinId,
    });

    return toVoiceNoteDTO(result.inserted, input.senderName);
  }

  /** Every voice note for a check-in — visible only to that check-in's author. */
  async list(checkinId: string, callerId: string): Promise<VoiceNoteDTO[]> {
    const ctx = await this.repo.checkinContext(this.database, checkinId);
    if (!ctx) throw new NotFoundError('Check-in not found');
    if (ctx.targetUserId !== callerId) {
      throw new ForbiddenError('Only the check-in author can view their voice notes');
    }

    const rows = await this.repo.listAll(this.database, checkinId);
    return rows.map((r) => toVoiceNoteDTO(r, r.senderName));
  }

  /**
   * The author acknowledges a note — it moves out of their New tab, and the
   * sender is thanked for this check-in same as the bulk "Thank you!" flow
   * would: their next Care Cards fetch surfaces a one-time "wants to show
   * gratitude" card before that check-in retires from their active list.
   */
  async markReceived(checkinId: string, noteId: string, callerId: string): Promise<void> {
    const ctx = await this.repo.checkinContext(this.database, checkinId);
    if (!ctx) throw new NotFoundError('Check-in not found');
    if (ctx.targetUserId !== callerId) {
      throw new ForbiddenError('Only the check-in author can acknowledge their voice notes');
    }

    const note = await this.repo.findById(this.database, noteId);
    if (!note || note.checkinId !== checkinId) throw new NotFoundError('Voice note not found');

    await this.database.transaction(async (tx) => {
      await this.repo.markReceived(tx, noteId);
      await gratitudeRepo.insertMany(tx, checkinId, [note.senderId]);
    });
  }
}

export const voiceNoteService = new VoiceNoteService();
