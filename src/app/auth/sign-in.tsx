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
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { redeemInviteCode } from '../../lib/inviteCode';
import { P, spacing, radius, shadow } from '../../design/tokens';
import { Starfield } from '../../design/Starfield';
import { Display, BodySm, Label, AppText } from '../../design/Text';

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) return;

    try {
      setLoading(true);
      const cred = await auth().signInAnonymously();
      const uid = cred.user.uid;
      await redeemInviteCode(inviteCode.trim(), uid);
      router.replace('/child/(tabs)/tasks');
    } catch (error: any) {
      await auth().signOut();
      let message = error.message;
      if (error.message === 'INVALID_CODE') message = '邀請碼無效 / Invalid code';
      if (error.message === 'CODE_USED') message = '邀請碼已使用 / Code already used';
      if (error.message === 'CODE_EXPIRED') message = '邀請碼已過期 / Code expired';
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleDevSignIn = async (role: 'parent' | 'child') => {
    const DEV_FAMILY_ID = 'dev-family-001';
    try {
      setLoading(true);
      const cred = await auth().signInAnonymously();
      const uid = cred.user.uid;
      const now = firestore.FieldValue.serverTimestamp();
      const batch = firestore().batch();

      batch.set(firestore().collection('users').doc(uid), {
        displayName: role === 'parent' ? 'Dev Parent' : 'Dev Child',
        avatarUrl: null,
        authProvider: 'anonymous',
        authProviderId: uid,
        roleType: role,
        birthday: null,
        createdAt: now,
      });

      if (role === 'parent') {
        batch.set(
          firestore().collection('families').doc(DEV_FAMILY_ID),
          { displayName: 'Dev Family', defaultGraceDays: 0, createdBy: uid, createdAt: now },
          { merge: true }
        );
      }

      batch.set(
        firestore().collection('familyMemberships').doc(`${DEV_FAMILY_ID}_${uid}`),
        { familyId: DEV_FAMILY_ID, userId: uid, role, status: 'active', invitedBy: uid, joinedAt: now }
      );

      batch.set(
        firestore().collection('pointWallets').doc(`${DEV_FAMILY_ID}_${uid}`),
        { userId: uid, familyId: DEV_FAMILY_ID, balance: 0, updatedAt: now }
      );

      await batch.commit();

      router.replace(
        role === 'parent' ? '/parent/(tabs)/tasks' : '/child/(tabs)/tasks'
      );
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
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

                <Label style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
                  {t('auth.childJoin')}
                </Label>

                {showInviteCode ? (
                  <View style={styles.inviteCodeSection}>
                    <TextInput
                      style={styles.codeInput}
                      placeholder="XXXXXX"
                      placeholderTextColor={P.muted}
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={6}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (inviteCode.length === 6) handleJoinWithCode();
                      }}
                    />
                    <View style={styles.codeActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.cancelCodeBtn,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => {
                          setShowInviteCode(false);
                          setInviteCode('');
                          Keyboard.dismiss();
                        }}
                      >
                        <AppText style={styles.cancelCodeText}>
                          {t('common.cancel')}
                        </AppText>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.joinBtn,
                          inviteCode.length < 6 && styles.joinBtnDisabled,
                          pressed && inviteCode.length === 6 && styles.pressed,
                        ]}
                        onPress={handleJoinWithCode}
                        disabled={inviteCode.length < 6}
                      >
                        <AppText style={styles.joinBtnText}>
                          {t('auth.join')}
                        </AppText>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.button,
                      styles.inviteButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setShowInviteCode(true)}
                  >
                    <AppText style={styles.inviteButtonText}>
                      {t('auth.enterInviteCode')}
                    </AppText>
                  </Pressable>
                )}

                <Label style={[styles.sectionLabel, { marginTop: spacing.lg, opacity: 0.6 }]}>
                  Beta 測試帳號
                </Label>
                <View style={styles.devRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.devButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleDevSignIn('parent')}
                  >
                    <AppText style={styles.devButtonText}>以家長身分進入</AppText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.devButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleDevSignIn('child')}
                  >
                    <AppText style={styles.devButtonText}>以孩子身分進入</AppText>
                  </Pressable>
                </View>
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
  inviteButton: {
    backgroundColor: P.primary,
    ...shadow.glow,
  },
  inviteButtonText: {
    color: P.bg,
    fontSize: 15,
    fontWeight: '800',
  },
  inviteCodeSection: {
    width: '100%',
    gap: spacing.sm,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: P.primary,
    borderRadius: radius.card,
    padding: spacing.md,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    color: P.text,
    backgroundColor: P.surface,
  },
  codeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelCodeBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cancelCodeText: {
    color: P.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  joinBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.full,
    backgroundColor: P.primary,
    alignItems: 'center',
    ...shadow.glow,
  },
  joinBtnDisabled: {
    opacity: 0.4,
  },
  joinBtnText: {
    color: P.bg,
    fontSize: 14,
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
