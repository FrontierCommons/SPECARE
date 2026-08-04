import { describe, it, expect, beforeEach, vi } from 'vitest';
import { linking } from './setup';
import {
  openWhatsApp,
  openMessage,
  openCall,
  outreachPrefill,
} from '../src/lib/deeplink';

beforeEach(() => {
  vi.clearAllMocks();
  linking.canOpenURL.mockResolvedValue(true);
});

describe('deeplink URL building', () => {
  it('builds a WhatsApp URL with encoded text', async () => {
    await openWhatsApp('hi there & friend');
    const url = linking.openURL.mock.calls[0]![0] as string;
    expect(url).toContain('whatsapp://send');
    expect(url).toContain('text=hi%20there%20%26%20friend');
  });

  it('includes phone in the WhatsApp URL when provided', async () => {
    await openWhatsApp('hey', '+15551234567');
    const url = linking.openURL.mock.calls[0]![0] as string;
    expect(url).toContain('phone=%2B15551234567');
  });

  it('builds an sms URL with a body param', async () => {
    await openMessage('thinking of you', '5551234');
    const url = linking.openURL.mock.calls[0]![0] as string;
    expect(url).toContain('sms:5551234');
    expect(url).toContain('body=thinking%20of%20you');
  });

  it('builds a tel URL', async () => {
    await openCall('5551234');
    expect(linking.openURL).toHaveBeenCalledWith('tel:5551234');
  });

  it('returns false and does not open when the scheme is unsupported', async () => {
    linking.canOpenURL.mockResolvedValue(false);
    const ok = await openWhatsApp('hey');
    expect(ok).toBe(false);
    expect(linking.openURL).not.toHaveBeenCalled();
  });

  it('returns true when the link opens', async () => {
    expect(await openCall('5551234')).toBe(true);
  });
});

describe('outreachPrefill', () => {
  it('addresses the friend by name and keeps a no-pressure tone', () => {
    const msg = outreachPrefill('Maya');
    expect(msg).toContain('Maya');
    expect(msg.toLowerCase()).toContain('no need to reply');
  });
});
