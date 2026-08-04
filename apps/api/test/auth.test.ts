import { describe, it, expect } from 'vitest';
import { uniqueEmail } from './setup';
import { AuthService } from '../src/modules/auth/auth.service';
import { signMagicLink, verifyAccess } from '../src/modules/auth/tokens';

const svc = new AuthService();

describe('AuthService.register', () => {
  it('creates an account and issues a usable access token', async () => {
    const email = uniqueEmail('reg');
    const res = await svc.register({ name: 'Reg', email, password: 'supersecret', timezone: 'UTC' });
    expect(res.user.email).toBe(email);
    expect(() => verifyAccess(res.tokens.access_token)).not.toThrow();
    expect(res.tokens.refresh_token).toBeTruthy();
  });

  it('never exposes the password hash in the user DTO', async () => {
    const res = await svc.register({
      name: 'Safe', email: uniqueEmail('safe'), password: 'supersecret', timezone: 'UTC',
    });
    expect(JSON.stringify(res.user)).not.toContain('supersecret');
    expect((res.user as Record<string, unknown>).password_hash).toBeUndefined();
  });

  it('rejects a password shorter than 8 characters', async () => {
    await expect(
      svc.register({ name: 'X', email: uniqueEmail('short'), password: 'short', timezone: 'UTC' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail('dup');
    await svc.register({ name: 'A', email, password: 'supersecret', timezone: 'UTC' });
    await expect(
      svc.register({ name: 'B', email, password: 'supersecret', timezone: 'UTC' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('treats email case-insensitively for duplicates', async () => {
    const email = uniqueEmail('Case');
    await svc.register({ name: 'A', email: email.toLowerCase(), password: 'supersecret', timezone: 'UTC' });
    await expect(
      svc.register({ name: 'B', email: email.toUpperCase(), password: 'supersecret', timezone: 'UTC' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('AuthService.login', () => {
  it('logs in with correct credentials', async () => {
    const email = uniqueEmail('login');
    await svc.register({ name: 'L', email, password: 'supersecret', timezone: 'UTC' });
    const res = await svc.login(email, 'supersecret');
    expect(res.user.email).toBe(email);
  });

  it('rejects a wrong password with UNAUTHORIZED', async () => {
    const email = uniqueEmail('wrongpw');
    await svc.register({ name: 'W', email, password: 'supersecret', timezone: 'UTC' });
    await expect(svc.login(email, 'nope')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects an unknown email uniformly (no user enumeration)', async () => {
    await expect(svc.login(uniqueEmail('ghost'), 'whatever')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('AuthService.refresh', () => {
  it('rotates to a fresh token pair', async () => {
    const res = await svc.register({
      name: 'R', email: uniqueEmail('refresh'), password: 'supersecret', timezone: 'UTC',
    });
    const rotated = await svc.refresh(res.tokens.refresh_token);
    expect(() => verifyAccess(rotated.access_token)).not.toThrow();
    expect(rotated.refresh_token).toBeTruthy();
  });

  it('rejects a garbage refresh token', async () => {
    await expect(svc.refresh('not-a-jwt')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects an access token used as a refresh token', async () => {
    const res = await svc.register({
      name: 'R2', email: uniqueEmail('mix'), password: 'supersecret', timezone: 'UTC',
    });
    await expect(svc.refresh(res.tokens.access_token)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

describe('AuthService magic link', () => {
  it('issues no token for an unknown email but does not throw', async () => {
    const { token } = await svc.issueMagicLink(uniqueEmail('nobody'));
    expect(token).toBeNull();
  });

  it('verifies a valid magic link into a session', async () => {
    const email = uniqueEmail('magic');
    const reg = await svc.register({ name: 'M', email, password: 'supersecret', timezone: 'UTC' });
    const { token } = await svc.issueMagicLink(email);
    expect(token).toBeTruthy();
    const res = await svc.verifyMagicLink(token!);
    expect(res.user.id).toBe(reg.user.id);
  });

  it('rejects a magic link for a non-existent user id', async () => {
    const forged = signMagicLink('00000000-0000-0000-0000-000000000000');
    await expect(svc.verifyMagicLink(forged)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a tampered magic link', async () => {
    await expect(svc.verifyMagicLink('tampered.token.value')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
