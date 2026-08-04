import { color, colorForName } from '../design/tokens';

interface Props {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}

/**
 * A person, everywhere in the app: their photo if they've set one, otherwise
 * their first initial on a color deterministically drawn from their name —
 * so the same person always reads the same color without us storing one.
 */
export function Avatar({ name, avatarUrl, size = 44 }: Props) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied URLs, not a Next/Image-known domain set
    return <img src={avatarUrl} alt={name} style={{ ...dimension, backgroundColor: color.surfaceRaised, objectFit: 'cover' }} />;
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      style={{ ...dimension, backgroundColor: colorForName(name) }}
      className="flex items-center justify-center"
    >
      <span style={{ color: color.bg, fontWeight: 700, fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
}

export default Avatar;
