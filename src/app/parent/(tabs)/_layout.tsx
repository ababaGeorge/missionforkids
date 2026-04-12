import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function ParentTabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#999',
        headerStyle: { backgroundColor: '#4A90D9' },
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
        name="review"
        options={{
          title: t('review.pendingReviews'),
          tabBarLabel: t('review.pendingReviews'),
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
        name="family"
        options={{
          title: t('family.members'),
          tabBarLabel: t('family.members'),
        }}
      />
    </Tabs>
  );
}
