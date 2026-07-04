import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export interface RegisterChildInput {
  inviteId: string;
  email: string;
  password: string;
}

export async function registerChild(
  input: RegisterChildInput
): Promise<{ familyId: string; childId: string }> {
  // 兩步流程需可恢復：若 createUser 成功但 acceptFamilyInvite 失敗，孤兒 Auth 帳號會讓
  // 重試永遠撞 email-already-in-use，邀請永久卡死。此時改用登入取回 session 再補跑
  // acceptFamilyInvite（CF 冪等：同 uid 已接受回既有；錢包只在不存在時建，不歸零）。
  try {
    await auth().createUserWithEmailAndPassword(input.email, input.password);
  } catch (e: any) {
    if (e?.code === 'auth/email-already-in-use') {
      await auth().signInWithEmailAndPassword(input.email, input.password);
    } else {
      throw e;
    }
  }
  const fn = functions().httpsCallable('acceptFamilyInvite');
  const res = await fn({ inviteId: input.inviteId });
  return res.data as { familyId: string; childId: string };
}
