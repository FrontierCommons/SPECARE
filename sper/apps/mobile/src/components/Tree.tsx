import React from 'react';
import { Image } from 'react-native';

export type TreeStage = 'small' | 'growing';

/** Every sprout image (healthy or withering, either stage) shares this canvas. */
const SPROUT_ASPECT = 1; // 500x500

const SPROUT_IMAGES: Record<TreeStage, { healthy: number; withering: number }> = {
  small: {
    healthy: require('../../assets/images/small/small.png'),
    withering: require('../../assets/images/small/withering_small.png'),
  },
  growing: {
    healthy: require('../../assets/images/growing/growing.png'),
    withering: require('../../assets/images/growing/withering-growing.png'),
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
  const height = width * SPROUT_ASPECT;
  const source = healthy ? SPROUT_IMAGES[stage].healthy : SPROUT_IMAGES[stage].withering;

  return <Image source={source} style={{ width, height }} resizeMode="contain" />;
}

export default Tree;
