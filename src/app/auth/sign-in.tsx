import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { redeemInviteCode } from '../../lib/inviteCode';

// TODO: 從 Firebase Console 取得 webClientId，目前用 placeholder
// GoogleSignin.configure({ webClientId: 'YOUR_WEB_CLIENT_ID' });

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  // ========== 家長：Google Sign-In ==========
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('No ID token');

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const cred = await auth().signInWithCredential(googleCredential);
      const uid = cred.user.uid;

      // 檢查是否已有 user doc
      const userDoc = await firestore().collection('users').doc(uid).get();
      if (!userDoc.exists) {
        // 首次登入，建立 parent user doc
        await firestore().collection('users').doc(uid).set({
          displayName: cred.user.displayName || 'Parent',
          avatarUrl: cred.user.photoURL || null,
          authProvider: 'google',
          authProviderId: uid,
          roleType: 'parent',
          birthday: null,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      router.replace('/parent/(tabs)/tasks');
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  // ========== 家長：Apple Sign-In（待 Apple Developer 啟用）==========
  const handleAppleSignIn = async () => {
    Alert.alert(
      'Apple Sign-In',
      'Apple Developer 帳號驗證中，請先用 Google 登入。'
    );
  };

  // ========== 孩子：邀請碼加入 ==========
  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) return;

    try {
      setLoading(true);

      // 孩子用匿名帳號登入
      const cred = await auth().signInAnonymously();
      const uid = cred.user.uid;

      // 兌換邀請碼（將 auth UID 綁定到 child user doc）
      await redeemInviteCode(inviteCode.trim(), uid);

      router.replace('/child/(tabs)/tasks');
    } catch (error: any) {
      // 登入失敗要登出，避免殘留匿名帳號
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

  // ========== Dev 模式：快速測試 ==========
  const handleDevSignIn = async (role: 'parent' | 'child') => {
    try {
      setLoading(true);
      const cred = await auth().signInAnonymously();
      const uid = cred.user.uid;

      const userDoc = await firestore().collection('users').doc(uid).get();
      if (!userDoc.exists) {
        await firestore().collection('users').doc(uid).set({
          displayName: role === 'parent' ? 'Dev Parent' : 'Dev Child',
          avatarUrl: null,
          authProvider: 'anonymous',
          authProviderId: uid,
          roleType: role,
          birthday: null,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.welcome')}</Text>
      <Text style={styles.subtitle}>Mission for Kids</Text>

      <View style={styles.buttonGroup}>
        {/* 家長登入 */}
        <Text style={styles.sectionLabel}>{t('auth.parentSignIn') || '家長登入'}</Text>

        <TouchableOpacity
          style={[styles.button, styles.appleButton]}
          onPress={handleAppleSignIn}
        >
          <Text style={styles.appleButtonText}>
            {t('auth.signInWithApple')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleSignIn}
        >
          <Text style={styles.googleButtonText}>
            {t('auth.signInWithGoogle')}
          </Text>
        </TouchableOpacity>

        {/* 孩子加入 */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
          {t('auth.childJoin') || '孩子加入'}
        </Text>

        {showInviteCode ? (
          <View style={styles.inviteCodeSection}>
            <TextInput
              style={styles.codeInput}
              placeholder="XXXXXX"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />
            <View style={styles.codeActions}>
              <TouchableOpacity
                style={styles.cancelCodeBtn}
                onPress={() => {
                  setShowInviteCode(false);
                  setInviteCode('');
                }}
              >
                <Text style={styles.cancelCodeText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.joinBtn,
                  inviteCode.length < 6 && styles.joinBtnDisabled,
                ]}
                onPress={handleJoinWithCode}
                disabled={inviteCode.length < 6}
              >
                <Text style={styles.joinBtnText}>
                  {t('auth.join') || '加入'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.inviteButton]}
            onPress={() => setShowInviteCode(true)}
          >
            <Text style={styles.inviteButtonText}>
              {t('auth.enterInviteCode') || '輸入邀請碼'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Dev 模式 */}
        {__DEV__ && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24, color: '#999' }]}>
              Dev Mode
            </Text>
            <View style={styles.devRow}>
              <TouchableOpacity
                style={styles.devButton}
                onPress={() => handleDevSignIn('parent')}
              >
                <Text style={styles.devButtonText}>Dev Parent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.devButton}
                onPress={() => handleDevSignIn('child')}
              >
                <Text style={styles.devButtonText}>Dev Child</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 48,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButton: {
    backgroundColor: '#FF9500',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteCodeSection: {
    width: '100%',
    gap: 12,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: '#FF9500',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#333',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelCodeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelCodeText: {
    color: '#666',
    fontSize: 16,
  },
  joinBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#FF9500',
    alignItems: 'center',
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  devRow: {
    flexDirection: 'row',
    gap: 12,
  },
  devButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  devButtonText: {
    color: '#999',
    fontSize: 14,
  },
});
