import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const PARTICLE_COUNT = 30;
const COLORS = ['#FF9500', '#FFD700', '#34C759', '#4A90D9', '#FF3B30', '#AF52DE'];

interface Props {
  points: number;
  onComplete: () => void;
}

function Particle({ delay }: { delay: number }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const startX = Math.random() * width;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const size = 6 + Math.random() * 8;

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 100;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height * 0.8,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: drift,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: (Math.random() - 0.5) * 10,
          duration: 2500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay, translateY, translateX, opacity, rotate]);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: startX,
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: Math.random() > 0.5 ? size / 2 : 2,
          opacity,
          transform: [
            { translateY },
            { translateX },
            {
              rotate: rotate.interpolate({
                inputRange: [-10, 10],
                outputRange: ['-360deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export default function CelebrationOverlay({ points, onComplete }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onComplete());
  }, [scale, textOpacity, onComplete]);

  return (
    <View style={styles.overlay} pointerEvents="none">
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <Particle key={i} delay={i * 50} />
      ))}
      <Animated.View
        style={[
          styles.textContainer,
          { transform: [{ scale }], opacity: textOpacity },
        ]}
      >
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.pointsText}>+{points}</Text>
        <Text style={styles.pointsLabel}>points!</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
  textContainer: {
    position: 'absolute',
    top: height * 0.35,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  pointsText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FF9500',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pointsLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
});
