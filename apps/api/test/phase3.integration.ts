import { db, pool } from '../src/config/db';
import { users, invites } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { CircleService } from '../src/modules/circles/circles.service';
import { InviteService } from '../src/modules/circles/invites.service';
import { PactService } from '../src/modules/circles/pact.service';
import { CircleRepo } from '../src/modules/circles/circles.repo';
import type { CircleEventDispatcher } from '../src/modules/circles/circle-events';

let ok = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { ok++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
}

async function mkUser(name: string) {
  const [u] = await db
    .insert(users)
    .values({ name, email: `${name.toLowerCase()}-${Date.now()}-${Math.random()}@t.co`, timezone: 'UTC' })
    .returning();
  return u!;
}

async function main() {
  const owner = await mkUser('P3Owner');
  const joiner = await mkUser('P3Joiner');
  const linkJoiner = await mkUser('P3LinkJoiner');

  // Spy on member-added events.
  const added: Array<{ circleId: string; newMemberName: string; recipientIds: string[] }> = [];
  const spyEvents: CircleEventDispatcher = {
    async memberAdded(i) { added.push(i); },
  };
  const circles = new CircleService(undefined, undefined, undefined, spyEvents);
  const repo = new CircleRepo();
  const pact = new PactService();
  const invitesSvc = new InviteService();

  console.log('\n[1] Create circle auto-adds creator (pact not yet agreed)');
  const circle = await circles.create('Manila Circle', owner.id);
  assert(!!circle.id && circle.name === 'Manila Circle', 'circle created with name');
  assert(await repo.isMember(db, circle.id, owner.id), 'creator auto-added as member');
  assert((await pact.hasAgreed(circle.id, owner.id)) === false, 'creator pact starts un-agreed');

  console.log('\n[2] Pact gate blocks access until agreed');
  let blocked = false;
  try { await circles.members(circle.id, owner.id); } catch { blocked = true; }
  assert(blocked, 'members() blocked before pact agreed');
  await circles.agreePact(circle.id, owner.id);
  assert(await pact.hasAgreed(circle.id, owner.id), 'pact agreed after agreePact()');
  const membersAfter = await circles.members(circle.id, owner.id);
  assert(membersAfter.length === 1, 'members() readable after pact, shows 1 member');

  console.log('\n[3] Invite by 6-char code, join, notify existing members');
  const invite = await circles.createInvite(circle.id, owner.id);
  assert(/^[A-Z0-9]{6}$/.test(invite.code), '6-char uppercase code generated');
  assert(invite.invite_link.includes('/invite/'), 'deep link contains invite id path');
  const joinRes = await circles.join({ code: invite.code }, joiner.id);
  assert(joinRes.circle.id === circle.id, 'joiner joined correct circle');
  assert(await repo.isMember(db, circle.id, joiner.id), 'joiner is now a member');
  assert((await pact.hasAgreed(circle.id, joiner.id)) === false, 'joiner pact starts un-agreed');
  assert(added.length === 1 && added[0]!.recipientIds.includes(owner.id), 'member-added notified existing member (owner)');
  assert(!added[0]!.recipientIds.includes(joiner.id), 'joiner not notified about their own join');

  console.log('\n[4] Code is not single-use (still redeemable)');
  const [invited] = await db.select().from(invites).where(eq(invites.code, invite.code));
  assert(!!invited, 'invite row still present after one join');

  console.log('\n[5] Join via invite-link token (invite id)');
  const invite2 = await circles.createInvite(circle.id, owner.id);
  const inviteId = invite2.invite_link.split('/').pop()!;
  const linkRes = await circles.join({ inviteToken: inviteId }, linkJoiner.id);
  assert(linkRes.circle.id === circle.id, 'link-joiner joined via token');
  assert(added.length === 2, 'second join fired member-added');
  assert(
    added[1]!.recipientIds.includes(owner.id) && added[1]!.recipientIds.includes(joiner.id),
    'both prior members notified on second join',
  );

  console.log('\n[6] Duplicate-join guard');
  const invite3 = await circles.createInvite(circle.id, owner.id);
  let dupBlocked = false;
  try { await circles.join({ code: invite3.code }, joiner.id); } catch { dupBlocked = true; }
  assert(dupBlocked, 'existing member cannot re-join');

  console.log('\n[7] Expired invite rejected');
  const expired = await invitesSvc.create(circle.id, undefined);
  await db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.code, expired.code));
  let expiredBlocked = false;
  try { await circles.join({ code: expired.code }, await mkUser('P3Late').then((u) => u.id)); }
  catch { expiredBlocked = true; }
  assert(expiredBlocked, 'expired invite cannot be redeemed');

  console.log('\n[8] Leave circle');
  await circles.leave(circle.id, linkJoiner.id);
  assert((await repo.isMember(db, circle.id, linkJoiner.id)) === false, 'member removed after leave()');

  console.log(`\n=== ${ok} passed, ${fail} failed ===`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
