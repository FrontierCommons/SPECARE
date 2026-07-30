import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup';
import { stores } from './setup';
import { api, ApiError, clearTokens } from '../src/api/client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();
// @ts-expect-error assigning to global fetch for the test
global.fetch = fetchMock;

beforeEach(async () => {
  vi.clearAllMocks();
  stores.secureMem.clear();
  await clearTokens();
});

describe('api.login', () => {
  it('stores tokens and returns the user', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: { id: 'u1', email: 'a@b.co' },
        tokens: { access_token: 'acc', refresh_token: 'ref', expires_in: 900 },
      }),
    );
    const res = await api.login({ email: 'a@b.co', password: 'pw' });
    expect(res.user.id).toBe('u1');
    expect(stores.secureMem.get('sper.access')).toBe('acc');
    expect(stores.secureMem.get('sper.refresh')).toBe('ref');
  });
});

describe('authenticated requests', () => {
  it('attaches the bearer token', async () => {
    stores.secureMem.set('sper.access', 'my-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sper: [] }));
    await api.sper('c1');
    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer my-token');
  });

  it('maps an error body to ApiError with code + message', async () => {
    stores.secureMem.set('sper.access', 'my-token');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'nope' } }),
    );
    await expect(api.sper('c1')).rejects.toBeInstanceOf(ApiError);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'nope' } }),
    );
    await api.sper('c1').catch((e: ApiError) => {
      expect(e.status).toBe(403);
      expect(e.code).toBe('FORBIDDEN');
    });
  });
});

describe('401 auto-refresh', () => {
  it('refreshes on 401 then retries the original request once', async () => {
    stores.secureMem.set('sper.access', 'stale');
    stores.secureMem.set('sper.refresh', 'good-refresh');

    fetchMock
      // 1) original request -> 401
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }))
      // 2) refresh -> new tokens
      .mockResolvedValueOnce(
        jsonResponse(200, {
          tokens: { access_token: 'fresh', refresh_token: 'fresh-ref', expires_in: 900 },
        }),
      )
      // 3) retried original -> 200
      .mockResolvedValueOnce(jsonResponse(200, { sper: [{ user_id: 'u1' }] }));

    const sper = await api.sper('c1');
    expect(sper).toHaveLength(1);
    expect(stores.secureMem.get('sper.access')).toBe('fresh');
    // original + refresh + retry = 3 fetches
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears tokens and throws when refresh also fails', async () => {
    stores.secureMem.set('sper.access', 'stale');
    stores.secureMem.set('sper.refresh', 'bad-refresh');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }))
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }));

    await expect(api.sper('c1')).rejects.toBeInstanceOf(ApiError);
    expect(stores.secureMem.get('sper.access')).toBeUndefined();
  });
});
