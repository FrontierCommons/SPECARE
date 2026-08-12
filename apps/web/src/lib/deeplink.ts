/**
 * The off-app bridge. These build the URLs that hand a responder to their own
 * messaging app with context pre-filled, so the best session ends by LEAVING
 * SPER. Web port of apps/mobile/src/lib/deeplink.ts: `whatsapp://` becomes
 * the `https://wa.me/` web link.
 *
 * "Send a message" no longer uses this file — that's an in-app composer now
 * (MessageComposerSheet), not an off-app deep link.
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

export async function openCall(phone: string): Promise<boolean> {
  window.location.href = `tel:${phone}`;
  return true;
}
