import functions from '@react-native-firebase/functions';
import { ensureAuthUser } from './ensureAuthUser';

export interface RegisterParentInput {
  email: string;
  password: string;
  displayName: string;
  familyName: string;
}

export async function registerParent(
  input: RegisterParentInput
): Promise<{ familyId: string }> {
  // 孤兒帳號可恢復：上次 createUser 成功但 bootstrap 失敗時，改登入取回 session
  // 再補跑（bootstrapParentAccount 冪等，已建過會回既有 familyId）。
  await ensureAuthUser(input.email, input.password);
  const fn = functions().httpsCallable('bootstrapParentAccount');
  const res = await fn({
    displayName: input.displayName,
    familyName: input.familyName,
  });
  return { familyId: (res.data as { familyId: string }).familyId };
}
