import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
}

export default function AIThinkingAnimation({ visible }: Props) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

    const anim = Animated.parallel([
      animate(dot1, 0),
      animate(dot2, 200),
      animate(dot3, 400),
    ]);
    anim.start();

    return () => anim.stop();
  }, [visible, dot1, dot2, dot3]);

  const { t } = useTranslation();

  if (!visible) return null;

  const dotStyle = (anim: Animated.Value) => ({
    ...styles.dot,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -12],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    }),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('ai.thinking')}</Text>
      <View style={styles.dots}>
        <Animated.View style={dotStyle(dot1)} />
        <Animated.View style={dotStyle(dot2)} />
        <Animated.View style={dotStyle(dot3)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  dots: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF9500',
  },
});
