import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { uniqueEmail } from './setup';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

async function registerUser(name = 'User') {
  const email = uniqueEmail(name.toLowerCase());
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { name, email, password: 'supersecret', timezone: 'UTC' },
  });
  const body = res.json();
  return { email, token: body.tokens.access_token as string, userId: body.user.id as string };
}
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('Auth endpoints', () => {
  it('register returns 201 with tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'A', email: uniqueEmail('a'), password: 'supersecret', timezone: 'UTC' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().tokens.access_token).toBeTruthy();
  });

  it('register with invalid email returns 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'A', email: 'not-an-email', password: 'supersecret', timezone: 'UTC' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('login with wrong password returns 401', async () => {
    const { email } = await registerUser('Wrong');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'incorrect' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('magic-link request returns 202 regardless of email existence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email: uniqueEmail('unknown') },
    });
    expect(res.statusCode).toBe(202);
  });
});

describe('Auth guard', () => {
  it('rejects a protected route with no token (401)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/circles', payload: { name: 'X' } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a protected route with a malformed token (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/circles',
      headers: { authorization: 'Bearer garbage' },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Full circle → check-in → care → touchpoint flow', () => {
  it('runs end to end with correct status codes', async () => {
    const owner = await registerUser('Owner');
    const friend = await registerUser('Friend');

    // Create circle
    let res = await app.inject({
      method: 'POST', url: '/api/v1/circles', headers: auth(owner.token), payload: { name: 'Flow' },
    });
    expect(res.statusCode).toBe(201);
    const circleId = res.json().circle.id as string;

    // Members blocked before pact
    res = await app.inject({
      method: 'GET', url: `/api/v1/circles/${circleId}/members`, headers: auth(owner.token),
    });
    expect(res.statusCode).toBe(403);

    // Agree pact
    res = await app.inject({
      method: 'POST', url: `/api/v1/circles/${circleId}/pact/agree`, headers: auth(owner.token),
    });
    expect(res.statusCode).toBe(200);

    // Invite + friend joins + agrees
    const invite = (
      await app.inject({
        method: 'POST', url: `/api/v1/circles/${circleId}/invites`, headers: auth(owner.token), payload: {},
      })
    ).json();
    res = await app.inject({
      method: 'POST', url: '/api/v1/circles/join', headers: auth(friend.token), payload: { code: invite.code },
    });
    expect(res.statusCode).toBe(200);
    await app.inject({
      method: 'POST', url: `/api/v1/circles/${circleId}/pact/agree`, headers: auth(friend.token),
    });

    // Distress check-in
    res = await app.inject({
      method: 'POST', url: '/api/v1/checkins', headers: auth(owner.token),
      payload: {
        circle_id: circleId,
        spiritual_state: 'Steady', physical_state: 'Steady', emotional_state: 'In the Pit',
        vocational_state: 'Steady', relational_state: 'Steady', optional_note: 'hard',
      },
    });
    expect(res.statusCode).toBe(201);
    const checkinId = res.json().checkin.id as string;
    expect(res.json().notification.verse).toBeTruthy();

    // Radar + care cards visible to friend
    res = await app.inject({
      method: 'GET', url: `/api/v1/circles/${circleId}/radar`, headers: auth(friend.token),
    });
    expect(res.json().radar).toHaveLength(2);
    res = await app.inject({
      method: 'GET', url: `/api/v1/circles/${circleId}/care-cards`, headers: auth(friend.token),
    });
    expect(res.json().care_cards).toHaveLength(1);

    // Touchpoint
    res = await app.inject({
      method: 'POST', url: `/api/v1/checkins/${checkinId}/touchpoints`,
      headers: auth(friend.token), payload: { type: 'VoiceNoteSent' },
    });
    expect(res.statusCode).toBe(201);
    res = await app.inject({
      method: 'GET', url: `/api/v1/checkins/${checkinId}/touchpoints`, headers: auth(friend.token),
    });
    expect(res.json().touchpoints).toHaveLength(1);
  });
});

describe('HTTP validation edges', () => {
  it('rejects an invalid state enum with 422', async () => {
    const owner = await registerUser('Enum');
    const circleId = (
      await app.inject({
        method: 'POST', url: '/api/v1/circles', headers: auth(owner.token), payload: { name: 'E' },
      })
    ).json().circle.id;
    await app.inject({
      method: 'POST', url: `/api/v1/circles/${circleId}/pact/agree`, headers: auth(owner.token),
    });
    const res = await app.inject({
      method: 'POST', url: '/api/v1/checkins', headers: auth(owner.token),
      payload: {
        circle_id: circleId,
        spiritual_state: 'Amazing', physical_state: 'Steady', emotional_state: 'Steady',
        vocational_state: 'Steady', relational_state: 'Steady',
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('rejects a note over 140 chars with 422', async () => {
    const owner = await registerUser('Note');
    const circleId = (
      await app.inject({
        method: 'POST', url: '/api/v1/circles', headers: auth(owner.token), payload: { name: 'N' },
      })
    ).json().circle.id;
    await app.inject({
      method: 'POST', url: `/api/v1/circles/${circleId}/pact/agree`, headers: auth(owner.token),
    });
    const res = await app.inject({
      method: 'POST', url: '/api/v1/checkins', headers: auth(owner.token),
      payload: {
        circle_id: circleId,
        spiritual_state: 'Steady', physical_state: 'Steady', emotional_state: 'Steady',
        vocational_state: 'Steady', relational_state: 'Steady', optional_note: 'x'.repeat(141),
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('non-member cannot read another circle radar (403)', async () => {
    const owner = await registerUser('OwnerX');
    const stranger = await registerUser('Stranger');
    const circleId = (
      await app.inject({
        method: 'POST', url: '/api/v1/circles', headers: auth(owner.token), payload: { name: 'Private' },
      })
    ).json().circle.id;
    const res = await app.inject({
      method: 'GET', url: `/api/v1/circles/${circleId}/radar`, headers: auth(stranger.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('device registration returns 201', async () => {
    const u = await registerUser('Device');
    const res = await app.inject({
      method: 'POST', url: '/api/v1/devices', headers: auth(u.token),
      payload: { token: `tok-${Date.now()}`, platform: 'ios' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('rejects an unknown device platform with 422', async () => {
    const u = await registerUser('BadDevice');
    const res = await app.inject({
      method: 'POST', url: '/api/v1/devices', headers: auth(u.token),
      payload: { token: 'tok', platform: 'windows' },
    });
    expect(res.statusCode).toBe(422);
  });
});
