import auth from '@react-native-firebase/auth';
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
  try {
    const res = await fn({ inviteId: input.inviteId });
    return res.data as { familyId: string; childId: string };
  } catch (e: any) {
    // R2-21(R2-05 審查)：ALREADY_PARENT 是永久性角色衝突（既有家長帳號接小孩邀請），
    // 重試不會成功。此時 ensureAuthUser 的恢復路徑已把裝置登入成該帳號，不登出的話
    // 殺 App 重開會直接以家長角色進首頁。先登出再拋錯；其他錯誤（網路/CF 冷啟動）
    // 保留 session 讓使用者重試走恢復路徑。登出失敗不吞原錯誤。
    if (/ALREADY_PARENT/.test(e?.message ?? '')) {
      try {
        await auth().signOut();
      } catch {}
    }
    throw e;
  }
}
