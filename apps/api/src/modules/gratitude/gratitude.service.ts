import { db, type DB } from '../../config/db';
import { GratitudeRepo, gratitudeRepo } from './gratitude.repo';
import { ForbiddenError, NotFoundError } from '../../shared/errors';

export class GratitudeService {
  constructor(
    private readonly repo: GratitudeRepo = gratitudeRepo,
    private readonly database: DB = db,
  ) {}

  /**
   * Only the check-in's own author may say thanks, and only to responders
   * not already thanked for it — a repeat "Thank you!" reaches whoever
   * responded since the last one, never re-thanking the same person twice.
   */
  async send(checkinId: string, callerId: string): Promise<{ thanked: number }> {
    return this.database.transaction(async (tx) => {
      const ctx = await this.repo.checkinContext(tx, checkinId);
      if (!ctx) throw new NotFoundError('Check-in not found');
      if (ctx.targetUserId !== callerId) {
        throw new ForbiddenError('Only the check-in author can send thanks');
      }

      const responderIds = await this.repo.unthankedResponderIds(tx, checkinId);
      await this.repo.insertMany(tx, checkinId, responderIds);
      return { thanked: responderIds.length };
    });
  }
}

export const gratitudeService = new GratitudeService();
