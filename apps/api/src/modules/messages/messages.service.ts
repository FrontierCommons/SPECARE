import { db, type DB } from '../../config/db';
import { MessageRepo, messageRepo } from './messages.repo';
import { touchpointRepo } from '../touchpoints/touchpoints.repo';
import { gratitudeRepo } from '../gratitude/gratitude.repo';
import { toInAppMessageDTO } from '../../shared/mappers';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import type { InAppMessageDTO } from '@sper/shared-types';

export const MESSAGE_MAX_LENGTH = 300;

/**
 * Delivery implements this to nudge the target that a message is waiting.
 * No-op default so the domain runs standalone.
 */
export interface MessageDispatcher {
  notifyMessage(input: { targetUserId: string; senderName: string; checkinId: string }): Promise<void>;
}

const noopDispatcher: MessageDispatcher = {
  async notifyMessage() {
    /* wired in delivery/wire.ts */
  },
};

export interface SendMessageInput {
  checkinId: string;
  senderId: string;
  senderName: string;
  body: string;
}

export class MessageService {
  constructor(
    private readonly repo: MessageRepo = messageRepo,
    private dispatcher: MessageDispatcher = noopDispatcher,
    private readonly database: DB = db,
  ) {}

  setDispatcher(dispatcher: MessageDispatcher): void {
    this.dispatcher = dispatcher;
  }

  /**
   * A responder writes to the check-in's author, in-app — the replacement
   * for the old off-app "Send a message" deep link. Writes the message and
   * a TextSent touchpoint in one transaction (so "already reached out"
   * stays accurate regardless of which action produced it), then nudges
   * the target post-commit.
   */
  async send(input: SendMessageInput): Promise<InAppMessageDTO> {
    const body = input.body.trim();
    if (!body) {
      throw new ValidationError('Message cannot be empty');
    }
    if (body.length > MESSAGE_MAX_LENGTH) {
      throw new ValidationError(`Messages must be under ${MESSAGE_MAX_LENGTH} characters`);
    }

    const result = await this.database.transaction(async (tx) => {
      const ctx = await this.repo.checkinContext(tx, input.checkinId);
      if (!ctx) throw new NotFoundError('Check-in not found');

      const isMember = await this.repo.isMember(tx, ctx.circleId, input.senderId);
      if (!isMember) throw new ForbiddenError('Not a member of this circle');
      if (ctx.targetUserId === input.senderId) {
        throw new ForbiddenError('Cannot send a message to your own check-in');
      }

      const inserted = await this.repo.insert(tx, {
        checkinId: input.checkinId,
        senderId: input.senderId,
        body,
      });

      await touchpointRepo.insert(tx, {
        checkinId: input.checkinId,
        responderId: input.senderId,
        type: 'TextSent',
      });

      return { inserted, targetUserId: ctx.targetUserId };
    });

    await this.dispatcher.notifyMessage({
      targetUserId: result.targetUserId,
      senderName: input.senderName,
      checkinId: input.checkinId,
    });

    return toInAppMessageDTO(result.inserted, input.senderName);
  }

  /** Every message for a check-in — visible only to that check-in's author. */
  async list(checkinId: string, callerId: string): Promise<InAppMessageDTO[]> {
    const ctx = await this.repo.checkinContext(this.database, checkinId);
    if (!ctx) throw new NotFoundError('Check-in not found');
    if (ctx.targetUserId !== callerId) {
      throw new ForbiddenError('Only the check-in author can view their messages');
    }

    const rows = await this.repo.listAll(this.database, checkinId);
    return rows.map((r) => toInAppMessageDTO(r, r.senderName));
  }

  /**
   * The author says "Thank you" — it moves out of their New tab, and the
   * sender is thanked for this check-in same as the bulk "Thank you!" flow
   * would: their next Care Cards fetch surfaces a one-time "wants to show
   * gratitude" card before that check-in retires from their active list.
   */
  async markReceived(checkinId: string, messageId: string, callerId: string): Promise<void> {
    const ctx = await this.repo.checkinContext(this.database, checkinId);
    if (!ctx) throw new NotFoundError('Check-in not found');
    if (ctx.targetUserId !== callerId) {
      throw new ForbiddenError('Only the check-in author can acknowledge their messages');
    }

    const message = await this.repo.findById(this.database, messageId);
    if (!message || message.checkinId !== checkinId) throw new NotFoundError('Message not found');

    await this.database.transaction(async (tx) => {
      await this.repo.markReceived(tx, messageId);
      await gratitudeRepo.insertMany(tx, checkinId, [message.senderId]);
    });
  }
}

export const messageService = new MessageService();
