import auth from '@react-native-firebase/auth';
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
  try {
    const res = await fn({
      displayName: input.displayName,
      familyName: input.familyName,
    });
    return { familyId: (res.data as { familyId: string }).familyId };
  } catch (e: any) {
    // R2-21(R2-05 審查)＋R3 審查修正：ALREADY_CHILD（既有小孩帳號打家長註冊）與
    // ALREADY_IN_FAMILY（既有帳號已有 active membership）都是永久性衝突，重試不會成功。
    // 此時 ensureAuthUser 的恢復路徑已把裝置登入成該帳號，不登出的話殺 App 重開
    // 會以該既有帳號（可能是錯誤角色/半身分狀態）直接進首頁。先登出再拋錯；
    // 其他錯誤（網路/CF 冷啟動）保留 session 讓使用者重試走恢復路徑。登出失敗不吞原錯誤。
    if (/ALREADY_CHILD|ALREADY_IN_FAMILY/.test(e?.message ?? '')) {
      try {
        await auth().signOut();
      } catch {}
    }
    throw e;
  }
}
