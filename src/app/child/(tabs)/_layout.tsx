import { Tabs } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { P, radius, spacing } from '../../../design/tokens';
import { Label } from '../../../design/Text';

type TabMeta = { key: string; name: string; label: string; icon: string };

const TABS: TabMeta[] = [
  { key: 'tasks', name: 'tasks', label: '任務', icon: '☰' },
  { key: 'rewards', name: 'rewards', label: '獎勵', icon: '✦' },
  { key: 'me', name: 'me', label: '我的', icon: '◉' },
  { key: 'notif', name: 'notif', label: '通知', icon: '◐' },
];

function PTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.bar}>
      {state.routes.map((route, idx) => {
        const meta = TABS.find((t) => t.name === route.name);
        if (!meta) return null;
        const focused = state.index === idx;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={styles.item}>
            <Label
              style={{
                fontSize: 18,
                lineHeight: 18,
                color: focused ? P.primary : P.muted,
                fontFamily: undefined,
              }}
            >
              {meta.icon}
            </Label>
            <Label
              style={{
                fontSize: 10,
                marginTop: 4,
                letterSpacing: 0.5,
                color: focused ? P.text : P.muted,
              }}
            >
              {meta.label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ChildTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: P.bg },
      }}
      tabBar={(props) => <PTabBar {...props} />}
    >
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="rewards" />
      <Tabs.Screen name="me" />
      <Tabs.Screen name="notif" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing.sm,
    paddingHorizontal: 12,
    paddingBottom: 18,
    flexDirection: 'row',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: P.border,
    backgroundColor: P.bg,
  },
  item: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
});
