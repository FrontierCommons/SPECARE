export type TreeStage = 'small' | 'growing';

const SPROUT_IMAGES: Record<TreeStage, { healthy: string; withering: string }> = {
  small: {
    healthy: '/images/small/small.png',
    withering: '/images/small/withering_small.png',
  },
  growing: {
    healthy: '/images/growing/growing.png',
    withering: '/images/growing/withering-growing.png',
  },
};

interface Props {
  /** Not distressed, OR distressed-but-prayed-for — either way, this reads as alive. */
  healthy: boolean;
  /** Only "growing" is used for now; per-user stage progression is future work. */
  stage?: TreeStage;
  width?: number;
}

/** The actual planted artwork — sprout and dirt in one image per stage/state. */
export function Tree({ healthy, stage = 'growing', width = 250 }: Props) {
  const src = healthy ? SPROUT_IMAGES[stage].healthy : SPROUT_IMAGES[stage].withering;
  // eslint-disable-next-line @next/next/no-img-element -- fixed square art asset, next/image adds no value here
  return <img src={src} alt="" width={width} height={width} style={{ objectFit: 'contain' }} />;
}

export default Tree;
