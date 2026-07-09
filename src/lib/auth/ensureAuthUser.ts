import auth from '@react-native-firebase/auth';

/**
 * 兩步註冊的第一步：建立 Auth 帳號，且孤兒帳號可恢復。
 *
 * 兩步流程（createUser → CF）若第一步成功、第二步失敗（網路/CF 冷啟動逾時），
 * Auth 帳號已存在成孤兒，直接重試會永遠撞 auth/email-already-in-use，
 * 該 email／邀請就永久卡死。此時改用同 email/密碼登入取回 session，
 * 讓呼叫端補跑冪等的 CF（bootstrapParentAccount 回既有 familyId；
 * acceptFamilyInvite 同 uid 重複接受安全）。
 *
 * 恢復登入密碼不符 → 拋 EMAIL_TAKEN_PASSWORD_MISMATCH
 * （code: auth/email-taken-password-mismatch），由 UI 映射成明確文案：
 * 該 email 已註冊、密碼不符，引導用原密碼或走忘記密碼。
 */
export async function ensureAuthUser(email: string, password: string): Promise<void> {
  try {
    await auth().createUserWithEmailAndPassword(email, password);
  } catch (e: any) {
    if (e?.code !== 'auth/email-already-in-use') throw e;
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (signInErr: any) {
      const code = signInErr?.code;
      // invalid-credential 是新版 SDK 對 wrong-password 的統一代碼
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        const err: any = new Error('EMAIL_TAKEN_PASSWORD_MISMATCH');
        err.code = 'auth/email-taken-password-mismatch';
        throw err;
      }
      throw signInErr;
    }
  }
}
