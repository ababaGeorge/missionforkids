import { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import { registerParent } from '../../lib/auth/registerParent';
import { extractInviteId } from '../../lib/inviteLink';
import { SafeAreaView } from 'react-native-safe-area-context';
import { P, spacing, radius, shadow } from '../../design/tokens';
import { Starfield } from '../../design/Starfield';
import { Display, H3, BodySm, Label, AppText } from '../../design/Text';

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

// UX-06：把 Firebase 原始錯誤代碼轉成家長看得懂的中文。
// 依 e?.code 對映；登入與註冊 catch 都走這個函式。
function mapAuthErrorMessage(code: string | undefined, isSignUp: boolean): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '帳號或密碼不對，再檢查一下';
    // registerParent 孤兒帳號恢復路徑：email 已註冊但恢復登入密碼不符
    case 'auth/email-taken-password-mismatch':
      return '這個 Email 已經註冊過但密碼不符，請改用原密碼登入，或用忘記密碼重設';
    case 'auth/invalid-email':
      return 'Email 格式不對';
    case 'auth/too-many-requests':
      return '試太多次了，休息一下再試';
    case 'auth/network-request-failed':
      return '網路連不上，檢查一下網路';
    default:
      return isSignUp ? '註冊失敗，請再試一次' : '登入失敗，請再試一次';
  }
}

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // 小孩端邀請入口：試用家庭收不到邀請信（Resend sandbox 限制），
  // 家長會把邀請連結分享到小孩裝置——這裡貼上整段訊息或連結即可進邀請頁。
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [inviteLinkText, setInviteLinkText] = useState('');
  const [inviteLinkError, setInviteLinkError] = useState('');

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
    setErrorMsg('');
    if (!email.trim() || !password) return;
    try {
      setLoading(true);
      await auth().signInWithEmailAndPassword(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setErrorMsg(mapAuthErrorMessage(e?.code, false));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    setErrorMsg('');
    if (!email.trim() || !password || !displayName.trim() || !familyName.trim()) return;
    try {
      setLoading(true);
      // 靜態 import（同 invite 頁 registerChild 慣例）：動態 import 在 jest 環境
      // 會炸 ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG，錯誤映射無法被測試覆蓋。
      await registerParent({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        familyName: familyName.trim(),
      });
      router.replace('/');
    } catch (e: any) {
      // CF 訊息碼用 message 比對（同 invite 頁慣例）：既有小孩帳號經孤兒恢復路徑
      // 打到 bootstrapParentAccount 會被擋（ALREADY_CHILD），給明確文案而非通用註冊失敗。
      if (/ALREADY_CHILD/.test(e?.message ?? '')) {
        setErrorMsg('這個 Email 是小孩帳號，不能用來註冊家長，請改用其他 Email');
      } else if (/ALREADY_IN_FAMILY/.test(e?.message ?? '')) {
        // R3-2：CF 擋「已有任一家庭 active membership 的帳號再建新家庭」（一帳號一家庭）
        setErrorMsg(t('auth.alreadyInFamily'));
      } else {
        setErrorMsg(mapAuthErrorMessage(e?.code, true));
      }
    } finally {
      setLoading(false);
    }
  };

  // R2-32：忘記密碼最小流程。用 Firebase 內建自助重設（sendPasswordResetEmail），
  // 不做家長代重設（專案決策）。user-not-found 沿用成功文案，避免帳號枚舉。
  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert(t('auth.forgotPassword'), t('auth.resetEmailEmptyEmail'));
      return;
    }
    try {
      setLoading(true);
      await auth().sendPasswordResetEmail(trimmedEmail);
      Alert.alert(t('auth.forgotPassword'), t('auth.resetEmailSent'));
    } catch (e: any) {
      switch (e?.code) {
        case 'auth/user-not-found':
          // 中性訊息：跟成功走同一文案，不透露帳號是否存在
          Alert.alert(t('auth.forgotPassword'), t('auth.resetEmailSent'));
          break;
        case 'auth/invalid-email':
        case 'auth/too-many-requests':
        case 'auth/network-request-failed':
          Alert.alert(t('auth.forgotPassword'), mapAuthErrorMessage(e.code, false));
          break;
        default:
          Alert.alert(t('auth.forgotPassword'), t('auth.resetEmailFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoToInvite = () => {
    // extractInviteId 已限制 charset（[A-Za-z0-9_-]），不會有路徑注入
    const id = extractInviteId(inviteLinkText);
    if (!id) {
      setInviteLinkError('無法辨識邀請連結，請確認有完整複製邀請訊息');
      return;
    }
    setShowInviteLink(false);
    setInviteLinkText('');
    setInviteLinkError('');
    router.push(`/invite/${id}` as any);
  };

  // dev：把固定真帳號（seed 建立）填入欄位，走正式 email/密碼登入。
  // 只填欄位、不替身、不碰 firestore。__DEV__-gated。
  const fillDevAccount = (devEmail: string) => {
    setAuthMode('signin');
    setEmail(devEmail);
    setPassword(DEV_PASSWORD);
    setErrorMsg(''); // 直接 set 欄位不走 onChangeText，這裡自己清舊錯誤
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Starfield />
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  const isSubmitDisabled = loading || !email.trim() || !password;

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
                    onChangeText={(v) => {
                      setEmail(v);
                      setErrorMsg('');
                    }}
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
                    onChangeText={(v) => {
                      setPassword(v);
                      setErrorMsg('');
                    }}
                    style={styles.input}
                  />
                  {authMode === 'signin' && (
                    <Pressable testID="forgot-password" onPress={handleForgotPassword}>
                      <BodySm style={{ color: P.muted, textAlign: 'right' }}>
                        {t('auth.forgotPassword')}
                      </BodySm>
                    </Pressable>
                  )}
                  {authMode === 'signup' && (
                    <>
                      <TextInput
                        testID="displayname-input"
                        placeholder="你的暱稱"
                        placeholderTextColor={P.muted}
                        value={displayName}
                        onChangeText={(v) => {
                          setDisplayName(v);
                          setErrorMsg('');
                        }}
                        style={styles.input}
                      />
                      <TextInput
                        testID="familyname-input"
                        placeholder="家庭名稱"
                        placeholderTextColor={P.muted}
                        value={familyName}
                        onChangeText={(v) => {
                          setFamilyName(v);
                          setErrorMsg('');
                        }}
                        style={styles.input}
                      />
                    </>
                  )}
                  {errorMsg ? (
                    <BodySm testID="auth-error" style={styles.errorText}>
                      {errorMsg}
                    </BodySm>
                  ) : null}
                  <Pressable
                    testID="email-submit"
                    onPress={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
                    disabled={isSubmitDisabled}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && styles.pressed,
                      isSubmitDisabled && styles.disabledBtn,
                    ]}
                  >
                    <AppText style={styles.inviteButtonText}>{authMode === 'signin' ? '登入' : '註冊並建立家庭'}</AppText>
                  </Pressable>
                  <Pressable
                    testID="toggle-auth-mode"
                    onPress={() => setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
                  >
                    <BodySm style={{ color: P.muted, textAlign: 'center' }}>{authMode === 'signin' ? '沒有帳號？註冊' : '已有帳號？登入'}</BodySm>
                  </Pressable>
                  <Pressable
                    testID="have-invite-link"
                    onPress={() => {
                      setInviteLinkText('');
                      setInviteLinkError('');
                      setShowInviteLink(true);
                    }}
                  >
                    <BodySm style={{ color: P.muted, textAlign: 'center' }}>
                      收到家庭邀請？我有邀請連結
                    </BodySm>
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

      {/* 我有邀請連結：貼上家長分享的整段訊息或連結（modal 慣例同 family.tsx） */}
      <Modal visible={showInviteLink} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={modalStyles.overlay}>
              <View style={modalStyles.sheet}>
                <H3 style={{ marginBottom: spacing.md }}>我有邀請連結</H3>
                <TextInput
                  testID="invite-link-input"
                  style={[modalStyles.input, modalStyles.multiline]}
                  placeholder="貼上邀請連結"
                  placeholderTextColor={P.muted}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={inviteLinkText}
                  onChangeText={(v) => {
                    setInviteLinkText(v);
                    setInviteLinkError('');
                  }}
                />
                {inviteLinkError ? (
                  <BodySm testID="invite-link-error" style={styles.errorText}>
                    {inviteLinkError}
                  </BodySm>
                ) : null}
                <View style={modalStyles.actions}>
                  <Pressable
                    onPress={() => setShowInviteLink(false)}
                    style={modalStyles.cancel}
                  >
                    <Label style={{ color: P.muted }}>取消</Label>
                  </Pressable>
                  <Pressable
                    testID="invite-link-go"
                    onPress={handleGoToInvite}
                    style={modalStyles.save}
                  >
                    <Label style={{ color: P.bg }}>前往邀請</Label>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
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
  disabledBtn: {
    opacity: 0.4,
  },
  errorText: {
    // R2-21(P7)：literal #FF6B6B 改用 tokens 內最接近的警示色（accentHot #FF6B47）
    color: P.accentHot,
    fontSize: 13,
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

// modal 慣例同 family.tsx（overlay + 底部 sheet）
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: P.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: P.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  input: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.bg,
    color: P.text,
    fontSize: 15,
    marginBottom: 12,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
  },
  save: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
  },
});
