import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { P } from './tokens';
import { spacing } from './tokens';
import { H3, Muted } from './Text';

type Props = {
  emoji: string;
  title: string;
  body?: string;
};

export function Empty({ emoji, title, body }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <H3 style={styles.title}>{title}</H3>
      {body ? <Muted style={styles.body}>{body}</Muted> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 42, marginBottom: spacing.sm, textAlign: 'center' },
  title: { textAlign: 'center', marginBottom: spacing.xs },
  body: { textAlign: 'center', maxWidth: 260 },
});
