import functions from '@react-native-firebase/functions';
import { ensureAuthUser } from './ensureAuthUser';

export interface RegisterChildInput {
  inviteId: string;
  email: string;
  password: string;
}

export async function registerChild(
  input: RegisterChildInput
): Promise<{ familyId: string; childId: string }> {
  // 孤兒帳號可恢復：上次 createUser 成功但 acceptFamilyInvite 失敗時，改登入取回
  // session 再補跑（CF 冪等：同 uid 已接受回既有；錢包只在不存在時建，不歸零）。
  await ensureAuthUser(input.email, input.password);
  const fn = functions().httpsCallable('acceptFamilyInvite');
  const res = await fn({ inviteId: input.inviteId });
  return res.data as { familyId: string; childId: string };
}
