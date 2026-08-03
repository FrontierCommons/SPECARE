/**
 * The off-app bridge. These build the URLs that hand a responder to their own
 * messaging app with context pre-filled, so the best session ends by LEAVING
 * SPER. No message is ever sent from inside the app.
 *
 * Web port of apps/mobile/src/lib/deeplink.ts: `whatsapp://` becomes the
 * `https://wa.me/` web link, `sms:`/`tel:` remain plain anchors. There is no
 * browser equivalent of RN's `Linking.canOpenURL` pre-check, so these always
 * attempt the navigation and report success optimistically — an accepted UX
 * regression versus mobile, not something fixable on the web.
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

export async function openMessage(text: string, phone?: string): Promise<boolean> {
  const base = phone ? `sms:${phone}` : 'sms:';
  window.location.href = `${base}?body=${encode(text)}`;
  return true;
}

export async function openCall(phone: string): Promise<boolean> {
  window.location.href = `tel:${phone}`;
  return true;
}

/** Suggested pre-fill for reaching out, kept short and warm. */
export function outreachPrefill(friendName: string): string {
  return `Hey ${friendName}, thinking of you — no need to reply, just wanted you to know I’m here.`;
}
