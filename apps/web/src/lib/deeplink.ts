/**
 * The off-app bridge. These build the URLs that hand a responder to their own
 * messaging app with context pre-filled, so the best session ends by LEAVING
 * SPER. No message is ever sent from inside the app.
 *
 * Web port of apps/mobile/src/lib/deeplink.ts: `whatsapp://` becomes the
 * `https://wa.me/` web link. `sms:` has no reliable browser equivalent of
 * RN's `Linking.canOpenURL` and is simply unhandled on desktop (no SMS app
 * registered), so `openMessage` no longer relies on it as the primary path —
 * it prefers the OS-level Web Share sheet (works on both mobile and most
 * modern desktop browsers), then clipboard, and only falls back to the raw
 * `sms:` link as a last resort.
 */

function encode(text: string): string {
  return encodeURIComponent(text);
}

export async function openWhatsApp(text: string, phone?: string): Promise<boolean> {
  const url = phone
    ? `https://wa.me/${encode(phone)}?text=${encode(text)}`
    : `https://wa.me/?text=${encode(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * `shared` — the OS share sheet completed. `copied` — no share sheet
 * available, but the message is on the clipboard. `cancelled` — the person
 * backed out of the share sheet, so nothing was sent or copied and no
 * touchpoint should be logged. `attempted` — last-resort raw `sms:` link,
 * fired blind since there's no way to confirm it landed.
 */
export type MessageOutcome = 'shared' | 'copied' | 'cancelled' | 'attempted';

export async function openMessage(text: string, phone?: string): Promise<MessageOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Some other Web Share failure (e.g. no share target registered) — fall through.
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Clipboard unavailable — fall through to the raw sms: link below.
    }
  }
  const base = phone ? `sms:${phone}` : 'sms:';
  window.location.href = `${base}?body=${encode(text)}`;
  return 'attempted';
}

export async function openCall(phone: string): Promise<boolean> {
  window.location.href = `tel:${phone}`;
  return true;
}

/** Suggested pre-fill for reaching out, kept short and warm. */
export function outreachPrefill(friendName: string): string {
  return `Hey ${friendName}, thinking of you — no need to reply, just wanted you to know I’m here.`;
}
