import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export interface RegisterParentInput {
  email: string;
  password: string;
  displayName: string;
  familyName: string;
}

export async function registerParent(
  input: RegisterParentInput
): Promise<{ familyId: string }> {
  // 兩步流程需可恢復：若上一次 createUser 成功但 bootstrap 失敗（網路/CF 冷啟動逾時），
  // Auth 帳號已存在成孤兒，直接重跑會撞 email-already-in-use。此時改用登入取回 session
  // 再補跑 bootstrap（CF 冪等，已建過會回既有 familyId）。
  try {
    await auth().createUserWithEmailAndPassword(input.email, input.password);
  } catch (e: any) {
    if (e?.code === 'auth/email-already-in-use') {
      await auth().signInWithEmailAndPassword(input.email, input.password);
    } else {
      throw e;
    }
  }
  const fn = functions().httpsCallable('bootstrapParentAccount');
  const res = await fn({
    displayName: input.displayName,
    familyName: input.familyName,
  });
  return { familyId: (res.data as { familyId: string }).familyId };
}
