import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { P, spacing, radius, shadow } from '../../design/tokens';
import { Starfield } from '../../design/Starfield';
import { Display, BodySm, Label, AppText } from '../../design/Text';

// dev 測試帳號（由 scripts/seed-dev-family.ts 建立的固定真帳號）。
// __DEV__-gated，production build 會被移除。
// A7：密碼不再寫死在原始碼（公開 repo 會洩漏）。改從環境變數讀，
// 啟動 Metro 時帶 EXPO_PUBLIC_DEV_PASSWORD=... 才會自動填入；沒帶就留空手動輸入。
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '';
const DEV_ACCOUNTS = [
  { label: '家長', email: 'dev-parent@mfk.test' },
  { label: '小安', email: 'dev-kid1@mfk.test' },
  { label: '小宇', email: 'dev-kid2@mfk.test' },
];

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');

  const handleGoogleSignIn = async () => {
    Alert.alert(
      'Google Sign-In',
      'Google Sign-In 尚未設定，請先用 Dev Mode 測試。'
    );
  };

  const handleAppleSignIn = async () => {
    Alert.alert(
      'Apple Sign-In',
      'Apple Developer 帳號驗證中，請先用 Google 登入。'
    );
  };

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) return;
    try {
      setLoading(true);
      await auth().signInWithEmailAndPassword(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email.trim() || !password || !displayName.trim() || !familyName.trim()) return;
    try {
      setLoading(true);
      const { registerParent } = await import('../../lib/auth/registerParent');
      await registerParent({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        familyName: familyName.trim(),
      });
      router.replace('/');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  // dev：把固定真帳號（seed 建立）填入欄位，走正式 email/密碼登入。
  // 只填欄位、不替身、不碰 firestore。__DEV__-gated。
  const fillDevAccount = (devEmail: string) => {
    setAuthMode('signin');
    setEmail(devEmail);
    setPassword(DEV_PASSWORD);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Starfield />
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Starfield />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Display style={styles.title}>{t('auth.welcome')}</Display>
              <BodySm style={styles.subtitle}>Mission for Kids</BodySm>

              <View style={styles.buttonGroup}>
                <View style={{ gap: spacing.sm, width: '100%' }}>
                  <TextInput
                    testID="email-input"
                    placeholder="Email"
                    placeholderTextColor={P.muted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                  />
                  <TextInput
                    testID="password-input"
                    placeholder="密碼"
                    placeholderTextColor={P.muted}
                    secureTextEntry
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
                    value={password}
                    onChangeText={setPassword}
                    style={styles.input}
                  />
                  {authMode === 'signup' && (
                    <>
                      <TextInput
                        testID="displayname-input"
                        placeholder="你的暱稱"
                        placeholderTextColor={P.muted}
                        value={displayName}
                        onChangeText={setDisplayName}
                        style={styles.input}
                      />
                      <TextInput
                        testID="familyname-input"
                        placeholder="家庭名稱"
                        placeholderTextColor={P.muted}
                        value={familyName}
                        onChangeText={setFamilyName}
                        style={styles.input}
                      />
                    </>
                  )}
                  <Pressable
                    testID="email-submit"
                    onPress={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                    disabled={loading}
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                  >
                    <AppText style={styles.inviteButtonText}>{authMode === 'signin' ? '登入' : '註冊並建立家庭'}</AppText>
                  </Pressable>
                  <Pressable
                    testID="toggle-auth-mode"
                    onPress={() => setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
                  >
                    <BodySm style={{ color: P.muted, textAlign: 'center' }}>{authMode === 'signin' ? '沒有帳號？註冊' : '已有帳號？登入'}</BodySm>
                  </Pressable>
                </View>

                <Label style={styles.sectionLabel}>{t('auth.parentSignIn')}</Label>

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.appleButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleAppleSignIn}
                >
                  <AppText style={styles.appleButtonText}>
                    {t('auth.signInWithApple')}
                  </AppText>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.googleButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleGoogleSignIn}
                >
                  <AppText style={styles.googleButtonText}>
                    {t('auth.signInWithGoogle')}
                  </AppText>
                </Pressable>

                {__DEV__ && (
                  <>
                    <Label style={[styles.sectionLabel, { marginTop: spacing.lg, opacity: 0.6 }]}>
                      Dev 測試帳號（自動填入）
                    </Label>
                    <View style={styles.devRow}>
                      {DEV_ACCOUNTS.map((a) => (
                        <Pressable
                          key={a.email}
                          testID={`dev-fill-${a.label}`}
                          style={({ pressed }) => [
                            styles.devButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => fillDevAccount(a.email)}
                        >
                          <AppText style={styles.devButtonText}>{a.label}</AppText>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: P.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    color: P.text,
    fontSize: 30,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: P.muted,
    fontSize: 14,
    marginBottom: spacing.xl,
    letterSpacing: 1.2,
  },
  sectionLabel: {
    color: P.muted,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.sm,
  },
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
    alignItems: 'center',
    ...shadow.glow,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  appleButton: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: P.border,
  },
  appleButtonText: {
    color: P.text,
    fontSize: 15,
    fontWeight: '800',
  },
  googleButton: {
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
  },
  googleButtonText: {
    color: P.text,
    fontSize: 15,
    fontWeight: '800',
  },
  inviteButtonText: {
    color: P.bg,
    fontSize: 15,
    fontWeight: '800',
  },
  devRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  devButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  devButtonText: {
    color: P.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
