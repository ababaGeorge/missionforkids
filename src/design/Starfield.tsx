import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { P } from './tokens';

type Props = {
  count?: number;
  seed?: number;
};

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function Starfield({ count = 22, seed = 7 }: Props) {
  const stars = useMemo(() => {
    const rand = rng(seed);
    return Array.from({ length: count }, (_, i) => {
      const gold = rand() < 0.12;
      return {
        key: i,
        left: `${rand() * 100}%` as const,
        top: `${rand() * 100}%` as const,
        size: gold ? 2.5 : 1 + rand() * 2,
        opacity: 0.3 + rand() * 0.6,
        gold,
      };
    });
  }, [count, seed]);

  return (
    <View pointerEvents="none" style={styles.layer}>
      {stars.map((s) => (
        <View
          key={s.key}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: s.gold ? P.star : '#F5F2E8',
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
