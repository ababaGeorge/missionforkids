import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { P } from './tokens';
import { fontFamily } from './fonts';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySm' | 'label' | 'muted' | 'data' | 'hero';

type Props = TextProps & {
  variant?: Variant;
  color?: string;
};

const variantStyles: Record<Variant, any> = {
  display: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 37, letterSpacing: -0.3, color: P.text },
  h1: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 33, color: P.text },
  h2: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 31, color: P.text },
  h3: { fontFamily: fontFamily.bodyBold, fontSize: 18, lineHeight: 24, color: P.text },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, color: P.text },
  bodySm: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: P.text },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.5, color: P.text },
  muted: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: P.muted },
  data: { fontFamily: fontFamily.data, fontSize: 15, lineHeight: 20, color: P.text, fontVariant: ['tabular-nums'] },
  hero: { fontFamily: fontFamily.display, fontSize: 48, lineHeight: 52, letterSpacing: -0.8, color: P.text },
};

export function AppText({ variant = 'body', color, style, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={[variantStyles[variant], color ? { color } : null, style]}
    />
  );
}

export function Display(props: Omit<Props, 'variant'>) {
  return <AppText variant="display" {...props} />;
}
export function H1(props: Omit<Props, 'variant'>) {
  return <AppText variant="h1" {...props} />;
}
export function H2(props: Omit<Props, 'variant'>) {
  return <AppText variant="h2" {...props} />;
}
export function H3(props: Omit<Props, 'variant'>) {
  return <AppText variant="h3" {...props} />;
}
export function Body(props: Omit<Props, 'variant'>) {
  return <AppText variant="body" {...props} />;
}
export function BodySm(props: Omit<Props, 'variant'>) {
  return <AppText variant="bodySm" {...props} />;
}
export function Label(props: Omit<Props, 'variant'>) {
  return <AppText variant="label" {...props} />;
}
export function Muted(props: Omit<Props, 'variant'>) {
  return <AppText variant="muted" {...props} />;
}
export function Data(props: Omit<Props, 'variant'>) {
  return <AppText variant="data" {...props} />;
}
export function Hero(props: Omit<Props, 'variant'>) {
  return <AppText variant="hero" {...props} />;
}
