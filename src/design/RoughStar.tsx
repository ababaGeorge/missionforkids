import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { P } from './tokens';
import { fontFamily } from './fonts';

type Props = {
  size?: number;
  color?: string;
  glow?: boolean;
  style?: TextStyle;
};

export function RoughStar({ size = 20, color = P.primary, glow = true, style }: Props) {
  return (
    <Text
      style={[
        {
          fontFamily: fontFamily.display,
          fontSize: size,
          lineHeight: size * 1.05,
          color,
          textShadowColor: glow ? P.primaryGlow : 'transparent',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: glow ? size * 0.35 : 0,
        },
        style,
      ]}
    >
      ★
    </Text>
  );
}
