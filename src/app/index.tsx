import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { P, spacing, radius } from '../design/tokens';
import { Starfield } from '../design/Starfield';
import { Body, Muted, Label } from '../design/Text';

export default function Index() {
  const { firebaseUser, user, loading, signOut } = useAuth();
  const router = useRouter();
  // 已登入但 profile 遲遲沒建好時的逃生出口：避免 bootstrap 永久失敗把帳號鎖死在轉圈
  const [stuck, setStuck] = useState(false);

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

  useEffect(() => {
    if (loading || !firebaseUser || user) {
      setStuck(false);
      return;
    }
    // 進入「已登入、無 profile」狀態超過 8 秒 → 顯示逃生出口
    const timer = setTimeout(() => setStuck(true), 8000);
    return () => clearTimeout(timer);
  }, [loading, firebaseUser, user]);

  return (
    <View style={styles.container}>
      <Starfield />
      <ActivityIndicator size="large" color={P.primary} />
      {stuck && (
        <View style={styles.stuckBox}>
          <Body style={{ textAlign: 'center' }}>帳號資料還沒準備好</Body>
          <Muted style={{ textAlign: 'center', marginTop: 6, fontSize: 12 }}>
            可能是網路不穩，重新登入通常就能修好。
          </Muted>
          <Muted style={{ textAlign: 'center', marginTop: 4, fontSize: 12 }}>
            若您註冊時中斷，請回註冊頁用同一組 Email 和密碼再送出一次即可修復。
          </Muted>
          <Pressable
            testID="stuck-relogin"
            onPress={async () => {
              try { await signOut(); } catch {}
              router.replace('/auth/sign-in');
            }}
            style={styles.stuckBtn}
          >
            <Label style={{ color: P.bg, fontWeight: '800' }}>重新登入</Label>
          </Pressable>
        </View>
      )}
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
  stuckBox: {
    position: 'absolute',
    bottom: 80,
    left: spacing.xl,
    right: spacing.xl,
    alignItems: 'center',
  },
  stuckBtn: {
    marginTop: spacing.md,
    backgroundColor: P.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
});
