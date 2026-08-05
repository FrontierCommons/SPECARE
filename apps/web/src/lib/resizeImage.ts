/**
 * Center-crops and downsizes a picked image to a small square JPEG data URI
 * before it's ever sent anywhere. There's no object storage in this app
 * (avatars ride inline in the same base64-in-Postgres pattern voice notes
 * use), and unlike a voice note, an avatar rides along on every member-list
 * and circle response — so it has to stay small at the source, not just
 * capped server-side.
 */
export async function resizeImageToSquareDataUrl(
  file: File,
  size = 256,
  quality = 0.8,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode image'));
    el.src = dataUrl;
  });

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  return canvas.toDataURL('image/jpeg', quality);
}
