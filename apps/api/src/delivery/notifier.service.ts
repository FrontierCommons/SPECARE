import { inArray, eq } from 'drizzle-orm';
import { db, type DB } from '../config/db';
import { users } from '../db/schema';
import { DeviceRepo, deviceRepo } from '../modules/users/devices.repo';
import { pushProvider, type PushProvider, type PushMessage } from './push.provider';
import { emailProvider, type EmailProvider } from './email.provider';
import { claimSend } from '../shared/idempotency';
import type { NotificationDispatcher } from '../modules/notifications/circle-notification.service';
import type { TouchpointAckDispatcher } from '../modules/touchpoints/touchpoints.service';
import type { CircleEventDispatcher } from '../modules/circles/circle-events';
import type { VoiceNoteDispatcher } from '../modules/voicenotes/voicenotes.service';
import type { MessageDispatcher } from '../modules/messages/messages.service';
import type { CircleNotificationRow, DeviceTokenRow } from '../db/schema';

interface RecipientContact {
  userId: string;
  name: string;
  email: string;
  tokens: DeviceTokenRow[];
}

/**
 * The concrete delivery orchestrator. Implements the two seams the Phase 1
 * domain services expose:
 *   - NotificationDispatcher.dispatchDistress  (circle-wide alert)
 *   - TouchpointAckDispatcher.ackTarget        (quiet "someone stepped up")
 *
 * Guarantees:
 *   - Exactly-once per (checkin_id, recipient_id) via claimSend().
 *   - Push first; email fallback only when a recipient has no live token.
 *   - Dead tokens reported by the provider are pruned.
 */
export class NotifierService
  implements
    NotificationDispatcher,
    TouchpointAckDispatcher,
    CircleEventDispatcher,
    VoiceNoteDispatcher,
    MessageDispatcher
{
  constructor(
    private readonly devices: DeviceRepo = deviceRepo,
    private readonly push: PushProvider = pushProvider,
    private readonly email: EmailProvider = emailProvider,
    private readonly database: DB = db,
  ) {}

  /* ---------------------- NotificationDispatcher ---------------------- */

  async dispatchDistress(input: {
    notification: CircleNotificationRow;
    recipientIds: string[];
  }): Promise<void> {
    const { notification, recipientIds } = input;
    if (recipientIds.length === 0) return;

    const targetName = await this.userName(notification.targetUserId);
    const contacts = await this.loadContacts(recipientIds);

    const title = `${targetName} could use some care`;
    const body = notification.verse
      ? `Reach out — a text, a call, or a prayer. ${notification.verse}`
      : 'Reach out — a text, a call, or a prayer.';
    const data = { type: 'distress', checkin_id: notification.checkinId };

    await Promise.all(
      contacts.map((c) => this.deliverOnce(notification.checkinId, c, title, body, data)),
    );
  }

  /* --------------------- TouchpointAckDispatcher ---------------------- */

  async ackTarget(input: {
    targetUserId: string;
    responderName: string;
    checkinId: string;
  }): Promise<void> {
    const [contact] = await this.loadContacts([input.targetUserId]);
    if (!contact) return;

    const title = 'Someone stepped up';
    const body = `${input.responderName} stepped up to hold space for you today.`;
    const data = { type: 'touchpoint_ack', checkin_id: input.checkinId };

    // Acks are not idempotency-tracked against the distress key space; each
    // responder yields one ack. Push with email fallback, no claim needed.
    await this.sendToContact(contact, title, body, data);
  }

  /* --------------------- CircleEventDispatcher ------------------------ */

  async memberAdded(input: {
    circleId: string;
    newMemberName: string;
    recipientIds: string[];
  }): Promise<void> {
    if (input.recipientIds.length === 0) return;
    const contacts = await this.loadContacts(input.recipientIds);

    const title = 'A new member joined your circle';
    const body = `${input.newMemberName} just joined. Say hello when you get a moment.`;
    const data = { type: 'member_added', circle_id: input.circleId };

    await Promise.all(contacts.map((c) => this.sendToContact(c, title, body, data)));
  }

  /* ------------------------------ Grace ------------------------------- */

  async graceNudge(input: {
    circleId: string;
    quietMemberName: string;
    recipientIds: string[];
  }): Promise<void> {
    if (input.recipientIds.length === 0) return;
    const contacts = await this.loadContacts(input.recipientIds);

    const title = `${input.quietMemberName} has been quiet`;
    const body =
      `${input.quietMemberName} has been quiet for a couple of weeks. ` +
      `No pressure for them to use the app — just drop a quick note to say you love them.`;
    const data = { type: 'grace_nudge', circle_id: input.circleId };

    await Promise.all(contacts.map((c) => this.sendToContact(c, title, body, data)));
  }

  /* ---------------------------- Care gap ------------------------------- */

  async careGapNudge(input: {
    checkinId: string;
    circleId: string;
    targetName: string;
    recipientIds: string[];
  }): Promise<void> {
    if (input.recipientIds.length === 0) return;
    const contacts = await this.loadContacts(input.recipientIds);

    const title = `${input.targetName} could use you today`;
    const body =
      `${input.targetName} checked in and hasn't heard from the circle yet. ` +
      `A text, a call, or a prayer would mean a lot.`;
    const data = { type: 'care_gap', checkin_id: input.checkinId };

    await Promise.all(contacts.map((c) => this.sendToContact(c, title, body, data)));
  }

  /* --------------------------- Voice notes ----------------------------- */

  async notifyVoiceNote(input: {
    targetUserId: string;
    senderName: string;
    checkinId: string;
  }): Promise<void> {
    const [contact] = await this.loadContacts([input.targetUserId]);
    if (!contact) return;

    const title = `${input.senderName} sent you a voice note`;
    const body = 'Tap to listen.';
    const data = { type: 'voice_note', checkin_id: input.checkinId };

    // One recording, one recipient, one push — no idempotency claim needed.
    await this.sendToContact(contact, title, body, data);
  }

  /* ----------------------------- Messages ------------------------------ */

  async notifyMessage(input: { targetUserId: string; senderName: string; checkinId: string }): Promise<void> {
    const [contact] = await this.loadContacts([input.targetUserId]);
    if (!contact) return;

    const title = `${input.senderName} sent you a message`;
    const body = 'Tap to read it.';
    const data = { type: 'in_app_message', checkin_id: input.checkinId };

    // One message, one recipient, one push — no idempotency claim needed.
    await this.sendToContact(contact, title, body, data);
  }

  /* ----------------------------- internals ---------------------------- */

  /** Deliver to one recipient exactly once for this check-in. */
  private async deliverOnce(
    checkinId: string,
    contact: RecipientContact,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    const won = await claimSend(checkinId, contact.userId);
    if (!won) return; // already sent (or in-flight) for this pair
    await this.sendToContact(contact, title, body, data);
  }

  /** Push to every live token; fall back to email if none succeeded. */
  private async sendToContact(
    contact: RecipientContact,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    let anyPushOk = false;

    for (const t of contact.tokens) {
      const msg: PushMessage = {
        token: t.token,
        platform: t.platform as PushMessage['platform'],
        title,
        body,
        data,
      };
      const res = await this.push.send(msg);
      if (res.ok) {
        anyPushOk = true;
      } else if (res.invalidToken) {
        await this.devices.remove(t.token);
      }
    }

    if (!anyPushOk) {
      await this.email.send({ to: contact.email, subject: title, body });
    }
  }

  private async loadContacts(userIds: string[]): Promise<RecipientContact[]> {
    if (userIds.length === 0) return [];
    const rows = await this.database
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));

    const tokens = await this.devices.listForUsers(userIds);
    const byUser = new Map<string, DeviceTokenRow[]>();
    for (const t of tokens) {
      const arr = byUser.get(t.userId) ?? [];
      arr.push(t);
      byUser.set(t.userId, arr);
    }

    return rows.map((r) => ({
      userId: r.id,
      name: r.name,
      email: r.email,
      tokens: byUser.get(r.id) ?? [],
    }));
  }

  private async userName(userId: string): Promise<string> {
    const [row] = await this.database
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.name ?? 'A friend';
  }
}

export const notifierService = new NotifierService();
