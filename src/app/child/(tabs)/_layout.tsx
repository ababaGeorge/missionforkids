import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function ChildTabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF9500',
        tabBarInactiveTintColor: '#999',
        headerStyle: { backgroundColor: '#FF9500' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tasks.title'),
          tabBarLabel: t('tasks.title'),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: t('rewards.store'),
          tabBarLabel: t('rewards.store'),
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          title: t('points.balance'),
          tabBarLabel: t('points.balance'),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: t('ai.title'),
          tabBarLabel: t('ai.title'),
        }}
      />
    </Tabs>
  );
}
