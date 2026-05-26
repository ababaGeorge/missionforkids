import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { P } from '../design/tokens';
import { Starfield } from '../design/Starfield';

export default function Index() {
  const { firebaseUser, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      router.replace('/auth/sign-in');
    } else if (!user) {
      // 已登入但 profile 還沒建好（bootstrap 進行中/失敗）— 停在 loading，不彈回 sign-in
      return;
    } else if (user.roleType === 'parent') {
      router.replace('/parent/(tabs)/tasks');
    } else {
      router.replace('/child/(tabs)/tasks');
    }
  }, [firebaseUser, user, loading]);

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
