import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, invites, makeUser } from './setup';
import { CircleService } from '../src/modules/circles/circles.service';
import { InviteService } from '../src/modules/circles/invites.service';
import { PactService } from '../src/modules/circles/pact.service';
import { CircleRepo } from '../src/modules/circles/circles.repo';
import type { CircleEventDispatcher } from '../src/modules/circles/circle-events';

function svc() {
  const added: Array<{ circleId: string; newMemberName: string; recipientIds: string[] }> = [];
  const events: CircleEventDispatcher = { async memberAdded(i) { added.push(i); } };
  return { service: new CircleService(undefined, undefined, undefined, events), added };
}

describe('CircleService.create', () => {
  it('creates a circle and auto-adds the creator (pact un-agreed)', async () => {
    const creator = await makeUser('Creator');
    const { service } = svc();
    const repo = new CircleRepo();
    const pact = new PactService();

    const circle = await service.create('Manila', creator.id);
    expect(circle.name).toBe('Manila');
    expect(await repo.isMember(db, circle.id, creator.id)).toBe(true);
    expect(await pact.hasAgreed(circle.id, creator.id)).toBe(false);
  });

  it('rejects an empty circle name', async () => {
    const creator = await makeUser('Creator');
    const { service } = svc();
    await expect(service.create('   ', creator.id)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});

describe('Pact gate', () => {
  it('blocks member list until the pact is agreed, then allows it', async () => {
    const creator = await makeUser('Creator');
    const { service } = svc();
    const circle = await service.create('C', creator.id);

    await expect(service.members(circle.id, creator.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await service.agreePact(circle.id, creator.id);
    const members = await service.members(circle.id, creator.id);
    expect(members).toHaveLength(1);
  });
});

describe('Invites & join', () => {
  it('generates a 6-char code and a deep link containing the invite id', async () => {
    const creator = await makeUser('Creator');
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    const invite = await service.createInvite(circle.id, creator.id);
    expect(invite.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(invite.invite_link).toContain('/invite/');
  });

  it('lets a new user join by code and notifies existing members only', async () => {
    const creator = await makeUser('Creator');
    const joiner = await makeUser('Joiner');
    const { service, added } = svc();
    const circle = await service.create('C', creator.id);
    const invite = await service.createInvite(circle.id, creator.id);

    const res = await service.join({ code: invite.code }, joiner.id);
    expect(res.circle.id).toBe(circle.id);
    expect(added).toHaveLength(1);
    expect(added[0]!.recipientIds).toContain(creator.id);
    expect(added[0]!.recipientIds).not.toContain(joiner.id);
  });

  it('joins by invite-link token (invite id)', async () => {
    const creator = await makeUser('Creator');
    const joiner = await makeUser('Joiner');
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    const invite = await service.createInvite(circle.id, creator.id);
    const inviteId = invite.invite_link.split('/').pop()!;
    const res = await service.join({ inviteToken: inviteId }, joiner.id);
    expect(res.circle.id).toBe(circle.id);
  });

  it('marks a code single-use and rejects reuse', async () => {
    const creator = await makeUser('Creator');
    const j1 = await makeUser('J1');
    const j2 = await makeUser('J2');
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    const invite = await service.createInvite(circle.id, creator.id);

    await service.join({ code: invite.code }, j1.id);
    const [redeemed] = await db.select().from(invites).where(eq(invites.code, invite.code));
    expect(redeemed!.redeemedBy).toBe(j1.id);
    await expect(service.join({ code: invite.code }, j2.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects an expired invite', async () => {
    const creator = await makeUser('Creator');
    const late = await makeUser('Late');
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    const invite = await service.createInvite(circle.id, creator.id);
    await db
      .update(invites)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invites.code, invite.code));
    await expect(service.join({ code: invite.code }, late.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a duplicate join by an existing member', async () => {
    const creator = await makeUser('Creator');
    const joiner = await makeUser('Joiner');
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    const invite1 = await service.createInvite(circle.id, creator.id);
    await service.join({ code: invite1.code }, joiner.id);
    const invite2 = await service.createInvite(circle.id, creator.id);
    await expect(service.join({ code: invite2.code }, joiner.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects join with neither code nor token', async () => {
    const u = await makeUser('U');
    const { service } = svc();
    await expect(service.join({}, u.id)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects a bad code', async () => {
    const u = await makeUser('U');
    const { service } = svc();
    await expect(service.join({ code: 'ZZZZZZ' }, u.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('Leave circle', () => {
  it('removes a member', async () => {
    const creator = await makeUser('Creator');
    const joiner = await makeUser('Joiner');
    const { service } = svc();
    const repo = new CircleRepo();
    const circle = await service.create('C', creator.id);
    const invite = await service.createInvite(circle.id, creator.id);
    await service.join({ code: invite.code }, joiner.id);

    await service.leave(circle.id, joiner.id);
    expect(await repo.isMember(db, circle.id, joiner.id)).toBe(false);
  });

  it('rejects leave by a non-member', async () => {
    const creator = await makeUser('Creator');
    const outsider = await makeUser('Outsider');
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    await expect(service.leave(circle.id, outsider.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('InviteService code generation', () => {
  it('produces unique codes across many invites', async () => {
    const creator = await makeUser('Creator');
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    const codes = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const inv = await service.createInvite(circle.id, creator.id);
      codes.add(inv.code);
    }
    expect(codes.size).toBe(25);
  });

  it('uses an unambiguous alphabet (no 0/O/1/I)', async () => {
    const creator = await makeUser('Creator');
    const inviteSvc = new InviteService();
    const { service } = svc();
    const circle = await service.create('C', creator.id);
    for (let i = 0; i < 20; i++) {
      const inv = await inviteSvc.create(circle.id, undefined);
      expect(inv.code).not.toMatch(/[01OI]/);
    }
  });
});
