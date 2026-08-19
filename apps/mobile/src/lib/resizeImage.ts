import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const AVATAR_SIZE = 256;

/**
 * Center-crops and downsizes the picked photo to a small square JPEG data
 * URI — avatars ride inline (base64-in-Postgres, like voice notes) rather
 * than object storage, and unlike a voice note an avatar rides along on
 * every member-list and circle response, so it must stay small at the
 * source rather than just capped server-side. Returns null if the user
 * cancels or permission is denied.
 */
export async function pickAndResizeAvatar(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const side = Math.min(asset.width, asset.height);
  const originX = (asset.width - side) / 2;
  const originY = (asset.height - side) / 2;

  const rendered = await ImageManipulator.manipulate(asset.uri)
    .crop({ originX, originY, width: side, height: side })
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();
  const output = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });

  return `data:image/jpeg;base64,${output.base64 ?? ''}`;
}
