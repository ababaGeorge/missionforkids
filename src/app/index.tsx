import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { P } from '../design/tokens';
import { Starfield } from '../design/Starfield';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/auth/sign-in');
    } else if (user.roleType === 'parent') {
      router.replace('/parent/(tabs)/tasks');
    } else {
      router.replace('/child/(tabs)/tasks');
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <Starfield />
      <ActivityIndicator size="large" color={P.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: P.bg,
  },
});
