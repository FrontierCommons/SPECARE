import { buildApp } from '../src/app';
import { pool, db } from '../src/config/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { runGraceLoop, type GraceDispatcher } from '../src/workers/grace-loop';
import { runPromptScheduler, type PromptSender } from '../src/workers/prompt-scheduler';

let ok = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { ok++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
}

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function main() {
  const app = await buildApp();

  // ---- Auth ----
  console.log('\n[1] Register + login + refresh');
  const email = `e2e-${uniq()}@t.co`;
  let res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name: 'Ownerly', email, password: 'supersecret', timezone: 'Asia/Manila' },
  });
  assert(res.statusCode === 201, 'register returns 201');
  const reg = res.json();
  const ownerToken = reg.tokens.access_token as string;
  const ownerId = reg.user.id as string;
  assert(!!ownerToken && !!reg.tokens.refresh_token, 'tokens issued on register');

  res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: 'supersecret' },
  });
  assert(res.statusCode === 200, 'login returns 200');

  res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refresh_token: reg.tokens.refresh_token },
  });
  assert(res.statusCode === 200 && !!res.json().tokens.access_token, 'refresh rotates tokens');

  console.log('\n[2] Auth guard rejects missing/invalid token');
  res = await app.inject({ method: 'POST', url: '/api/v1/circles', payload: { name: 'X' } });
  assert(res.statusCode === 401, 'protected route 401 without token');

  // ---- Circle + pact ----
  console.log('\n[3] Create circle, agree pact, invite, join');
  res = await app.inject({
    method: 'POST',
    url: '/api/v1/circles',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { name: 'E2E Circle' },
  });
  assert(res.statusCode === 201, 'circle created (201)');
  const circleId = res.json().circle.id as string;

  // members() before pact -> 403
  res = await app.inject({
    method: 'GET',
    url: `/api/v1/circles/${circleId}/members`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert(res.statusCode === 403, 'members blocked before pact (403)');

  res = await app.inject({
    method: 'POST',
    url: `/api/v1/circles/${circleId}/pact/agree`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert(res.statusCode === 200, 'pact agree 200');

  res = await app.inject({
    method: 'GET',
    url: `/api/v1/circles/${circleId}/members`,
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert(res.statusCode === 200 && res.json().members.length === 1, 'members readable after pact');

  // Second user joins via code
  const email2 = `e2e-${uniq()}@t.co`;
  const reg2 = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'Friendly', email: email2, password: 'supersecret', timezone: 'UTC' },
    })
  ).json();
  const friendToken = reg2.tokens.access_token as string;
  const friendId = reg2.user.id as string;

  const invite = (
    await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/invites`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    })
  ).json();
  res = await app.inject({
    method: 'POST',
    url: '/api/v1/circles/join',
    headers: { authorization: `Bearer ${friendToken}` },
    payload: { code: invite.code },
  });
  assert(res.statusCode === 200, 'friend joins via code (200)');
  await app.inject({
    method: 'POST',
    url: `/api/v1/circles/${circleId}/pact/agree`,
    headers: { authorization: `Bearer ${friendToken}` },
  });

  // ---- Check-in + sper + care ----
  console.log('\n[4] Distress check-in -> notification, sper, care-cards');
  res = await app.inject({
    method: 'POST',
    url: '/api/v1/checkins',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {
      circle_id: circleId,
      spiritual_state: 'Steady',
      physical_state: 'Steady',
      emotional_state: 'In the Pit',
      vocational_state: 'Steady',
      relational_state: 'Steady',
      optional_note: 'Tough one.',
    },
  });
  assert(res.statusCode === 201, 'check-in 201');
  const submit = res.json();
  const checkinId = submit.checkin.id as string;
  assert(!!submit.notification && !!submit.notification.verse, 'distress notification with verse returned');

  res = await app.inject({
    method: 'GET',
    url: `/api/v1/circles/${circleId}/sper`,
    headers: { authorization: `Bearer ${friendToken}` },
  });
  const sper = res.json().sper;
  assert(res.statusCode === 200 && sper.length === 2, 'sper shows 2 members');
  assert(sper.find((r: any) => r.user_id === ownerId)?.emotional_state === 'In the Pit', 'sper reflects distress');

  res = await app.inject({
    method: 'GET',
    url: `/api/v1/circles/${circleId}/care-cards`,
    headers: { authorization: `Bearer ${friendToken}` },
  });
  const cards = res.json().care_cards;
  assert(res.statusCode === 200 && cards.length === 1, 'one active care card');
  assert(cards[0].flagged_dimensions.includes('emotional'), 'care card flags emotional');

  console.log('\n[5] Touchpoint log + list, validation');
  res = await app.inject({
    method: 'POST',
    url: `/api/v1/checkins/${checkinId}/touchpoints`,
    headers: { authorization: `Bearer ${friendToken}` },
    payload: { type: 'VoiceNoteSent' },
  });
  assert(res.statusCode === 201, 'touchpoint logged (201)');

  res = await app.inject({
    method: 'GET',
    url: `/api/v1/checkins/${checkinId}/touchpoints`,
    headers: { authorization: `Bearer ${friendToken}` },
  });
  assert(res.statusCode === 200 && res.json().touchpoints.length === 1, 'touchpoint list has 1');

  res = await app.inject({
    method: 'POST',
    url: '/api/v1/checkins',
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: {
      circle_id: circleId,
      spiritual_state: 'Nope',
      physical_state: 'Steady',
      emotional_state: 'Steady',
      vocational_state: 'Steady',
      relational_state: 'Steady',
    },
  });
  assert(res.statusCode === 422, 'invalid state enum -> 422');

  console.log('\n[6] Device registration');
  res = await app.inject({
    method: 'POST',
    url: '/api/v1/devices',
    headers: { authorization: `Bearer ${friendToken}` },
    payload: { token: `dev-${uniq()}`, platform: 'ios' },
  });
  assert(res.statusCode === 201, 'device registered (201)');

  // ---- Workers ----
  console.log('\n[7] Grace loop pauses stale user + nudges circle');
  // Make owner stale.
  await db
    .update(users)
    .set({ lastCheckinAt: new Date(Date.now() - 20 * 24 * 3600 * 1000), notificationsPaused: false })
    .where(eq(users.id, ownerId));
  const nudges: string[] = [];
  const graceSpy: GraceDispatcher = {
    async graceNudge(i) { nudges.push(`${i.quietMemberName}->${i.recipientIds.join(',')}`); },
  };
  const processed = await runGraceLoop(graceSpy);
  const [ownerAfter] = await db.select().from(users).where(eq(users.id, ownerId));
  assert(processed >= 1, 'grace loop processed >=1 stale user');
  assert(ownerAfter!.notificationsPaused === true, 'stale user paused');
  assert(nudges.some((n) => n.startsWith('Ownerly->') && n.includes(friendId)), 'circle nudged toward quiet member');

  console.log('\n[8] Prompt scheduler skips paused, fires on local hour');
  const fired: string[] = [];
  const promptSpy: PromptSender = { async sendPrompt(i) { fired.push(i.userId); } };
  // friend tz=UTC; choose a `now` at 09:00 UTC so friend matches, owner (paused) skipped.
  const nowUtc9 = new Date(Date.UTC(2026, 0, 15, 9, 0, 0));
  await runPromptScheduler(promptSpy, db, nowUtc9);
  assert(fired.includes(friendId), 'prompt fired for UTC user at 09:00 local');
  assert(!fired.includes(ownerId), 'paused user skipped by scheduler');

  console.log(`\n=== ${ok} passed, ${fail} failed ===`);
  await app.close();
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
