import { Linking } from 'react-native';

/**
 * The off-app bridge. These build the URLs that hand a responder to their own
 * messaging app with context pre-filled, so the best session ends by LEAVING
 * SPER. No message is ever sent from inside the app.
 */

function encode(text: string): string {
  return encodeURIComponent(text);
}

export async function openWhatsApp(text: string, phone?: string): Promise<boolean> {
  const url = phone
    ? `whatsapp://send?phone=${encode(phone)}&text=${encode(text)}`
    : `whatsapp://send?text=${encode(text)}`;
  return tryOpen(url);
}

export async function openCall(phone: string): Promise<boolean> {
  return tryOpen(`tel:${phone}`);
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
