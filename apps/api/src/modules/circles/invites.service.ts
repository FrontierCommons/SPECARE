import { randomInt } from 'node:crypto';
import { db, type DB } from '../../config/db';
import { env } from '../../config/env';
import { InviteRepo, inviteRepo } from './invites.repo';
import { ConflictError, NotFoundError } from '../../shared/errors';
import type { InviteRow } from '../../db/schema';
import type { InviteResponse } from '@sper/shared-types';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

// Unambiguous alphabet: no 0/O/1/I to avoid transcription errors.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export class InviteService {
  constructor(
    private readonly repo: InviteRepo = inviteRepo,
    private readonly database: DB = db,
  ) {}

  /** Create an invite for a circle, returning the code + deep link. */
  async create(
    circleId: string,
    email: string | undefined,
    exec: Executor = this.database,
  ): Promise<InviteResponse> {
    const code = await this.generateUniqueCode(exec);
    const expiresAt = new Date(Date.now() + env.INVITE_CODE_TTL_HOURS * 3_600_000);

    const invite = await this.repo.create(exec, {
      circleId,
      code,
      expiresAt,
      ...(email !== undefined ? { email } : {}),
    });

    return {
      code: invite.code!,
      invite_link: `${env.APP_DEEPLINK_BASE}/${invite.id}`,
      expires_at: invite.expiresAt.toISOString(),
    };
  }

  /** Resolve a redeemable invite from either a code or a link token (invite id). */
  async resolveRedeemable(
    args: { code?: string; inviteToken?: string },
    exec: Executor = this.database,
  ): Promise<InviteRow> {
    let invite: InviteRow | null = null;
    if (args.code) {
      invite = await this.repo.findRedeemableByCode(exec, args.code.toUpperCase());
    } else if (args.inviteToken) {
      invite = await this.repo.findRedeemableById(exec, args.inviteToken);
    }
    if (!invite) {
      throw new NotFoundError('Invite is invalid, expired, or already used');
    }
    return invite;
  }

  async markRedeemed(inviteId: string, userId: string, exec: Executor = this.database): Promise<void> {
    await this.repo.markRedeemed(exec, inviteId, userId);
  }

  private async generateUniqueCode(exec: Executor): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      if (!(await this.repo.codeExists(exec, code))) return code;
    }
    throw new ConflictError('Could not allocate a unique invite code; retry');
  }
}

export const inviteService = new InviteService();
