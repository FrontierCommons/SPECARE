import { and, asc, eq, isNull } from 'drizzle-orm';
import type { DB } from '../../config/db';
import { voiceNotes, checkins, circleMemberships, users, type VoiceNoteRow } from '../../db/schema';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export interface VoiceNoteWithSender extends VoiceNoteRow {
  senderName: string;
}

export class VoiceNoteRepo {
  async insert(
    exec: Executor,
    values: {
      checkinId: string;
      senderId: string;
      audioBase64: string;
      mimeType: string;
      durationMs: number;
    },
  ): Promise<VoiceNoteRow> {
    const [row] = await exec.insert(voiceNotes).values(values).returning();
    return row!;
  }

  /** Resolve the circle + target (author) of a check-in. */
  async checkinContext(
    exec: Executor,
    checkinId: string,
  ): Promise<{ circleId: string; targetUserId: string } | null> {
    const [row] = await exec
      .select({ circleId: checkins.circleId, targetUserId: checkins.userId })
      .from(checkins)
      .where(eq(checkins.id, checkinId))
      .limit(1);
    return row ?? null;
  }

  async isMember(exec: Executor, circleId: string, userId: string): Promise<boolean> {
    const [row] = await exec
      .select({ id: circleMemberships.id })
      .from(circleMemberships)
      .where(and(eq(circleMemberships.circleId, circleId), eq(circleMemberships.userId, userId)))
      .limit(1);
    return !!row;
  }

  /** Every note for a check-in, pending and already-thanked alike, oldest
   * first — the caller buckets by `receivedAt` (New vs Already responded),
   * same convention as Care/Share Cards and in-app messages. */
  async listAll(exec: Executor, checkinId: string): Promise<VoiceNoteWithSender[]> {
    const rows = await exec
      .select({
        id: voiceNotes.id,
        checkinId: voiceNotes.checkinId,
        senderId: voiceNotes.senderId,
        audioBase64: voiceNotes.audioBase64,
        mimeType: voiceNotes.mimeType,
        durationMs: voiceNotes.durationMs,
        createdAt: voiceNotes.createdAt,
        receivedAt: voiceNotes.receivedAt,
        senderName: users.name,
      })
      .from(voiceNotes)
      .innerJoin(users, eq(users.id, voiceNotes.senderId))
      .where(eq(voiceNotes.checkinId, checkinId))
      .orderBy(asc(voiceNotes.createdAt));
    return rows as VoiceNoteWithSender[];
  }

  async findById(exec: Executor, id: string): Promise<VoiceNoteRow | null> {
    const [row] = await exec.select().from(voiceNotes).where(eq(voiceNotes.id, id)).limit(1);
    return row ?? null;
  }

  /** Idempotent: marking an already-received note again is a no-op. */
  async markReceived(exec: Executor, id: string): Promise<void> {
    await exec
      .update(voiceNotes)
      .set({ receivedAt: new Date() })
      .where(and(eq(voiceNotes.id, id), isNull(voiceNotes.receivedAt)));
  }
}

export const voiceNoteRepo = new VoiceNoteRepo();
