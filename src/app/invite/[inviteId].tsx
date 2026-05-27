import { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { P, spacing, radius, shadow } from '../../design/tokens';
import { Starfield } from '../../design/Starfield';
import { Display, BodySm, AppText } from '../../design/Text';
import { getFamilyInvite } from '../../lib/familyInvite';
import { registerChild } from '../../lib/auth/registerChild';
import type { FamilyInvite } from '../../types/models';

export default function AcceptInvite() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const inv = inviteId ? await getFamilyInvite(String(inviteId)) : null;
        if (!active) return;
        setInvite(inv);
        if (inv?.email) setEmail(inv.email);
      } catch {
        // 讀取失敗（權限/網路）→ 當成無效邀請，由 fallback 畫面處理，不外洩 uncaught rejection
        if (active) setInvite(null);
      } finally {
        if (active) setLoadingInvite(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [inviteId]);

  const handleAccept = async () => {
    if (!email.trim() || !password || !inviteId) return;
    try {
      setSubmitting(true);
      await registerChild({ inviteId: String(inviteId), email: email.trim(), password });
      router.replace('/child/(tabs)/tasks');
    } catch (e: any) {
      let msg = e?.message ?? '接受邀請失敗';
      if (/INVITE_EXPIRED/.test(msg)) msg = '邀請已過期';
      if (/INVITE_ALREADY_USED/.test(msg)) msg = '邀請已被使用';
      if (/INVALID_INVITE/.test(msg)) msg = '邀請無效';
      Alert.alert('無法加入', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite || submitting) {
    return (
      <View style={styles.center}>
        <Starfield />
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  if (!invite || invite.status !== 'pending') {
    return (
      <View style={styles.center}>
        <Starfield />
        <BodySm style={{ color: P.muted, textAlign: 'center', marginBottom: spacing.lg }}>
          這個邀請無效或已被使用。
        </BodySm>
        <Pressable
          testID="invite-invalid-home"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
        >
          <AppText style={styles.primaryBtnText}>回到首頁</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Starfield />
      <SafeAreaView style={styles.body} edges={['top', 'bottom']}>
        <Display style={styles.title}>你被邀請加入</Display>
        <BodySm style={styles.sub}>
          「{invite.childProfile?.displayName ?? '小孩'}」加入家庭
          {invite.childProfile?.nickname ? `（暱稱：${invite.childProfile.nickname}）` : ''}
        </BodySm>
        <View style={{ gap: spacing.sm, width: '100%', marginTop: spacing.lg }}>
          {/* email 從 invite 預填且唯讀：acceptFamilyInvite 會驗證 token email == invite.email，
              讓小孩改 email 只會建出被擋的孤兒帳號，故鎖死不可改。 */}
          <TextInput
            testID="invite-email"
            placeholder="Email"
            placeholderTextColor={P.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            editable={false}
            style={[styles.input, { opacity: 0.7 }]}
          />
          <TextInput
            testID="invite-password"
            placeholder="設定密碼"
            placeholderTextColor={P.muted}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Pressable
            testID="invite-submit"
            onPress={handleAccept}
            disabled={submitting}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
          >
            <AppText style={styles.primaryBtnText}>建立帳號並加入</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg, paddingHorizontal: spacing.lg },
  title: { color: P.text, fontSize: 28, textAlign: 'center' },
  sub: { color: P.muted, textAlign: 'center', marginTop: spacing.xs },
  input: {
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: P.text,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: P.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    ...shadow.glow,
  },
  primaryBtnText: { color: P.bg, fontSize: 15, fontWeight: '800' },
});
