import firestore from '@react-native-firebase/firestore';
import type { FamilyMembership, User } from '../types/models';

// family-scoped 顯示規則的「單一來源」：暱稱優先於真實 displayName。
// 任務頁 / 審核頁 / 通知頁 / 商城頁全部走這裡，與「家庭」設定頁一致。

export const memberName = (
  membership: Pick<FamilyMembership, 'nickname'> | null | undefined,
  user: Pick<User, 'displayName'> | null | undefined,
  fallback = '小朋友'
): string =>
  membership?.nickname?.trim() || user?.displayName?.trim() || fallback;

export const memberAvatar = (
  membership: Pick<FamilyMembership, 'avatarEmoji'> | null | undefined
): string | null => membership?.avatarEmoji?.trim() || null;

// 解析一個 member userId 對應的 user doc。
// 比照 useAuth：先用 doc id 直查（家長 / placeholder 小孩 doc id == userId），
// 查不到再用 authProviderId 查（透過邀請碼加入的小孩，auth uid 寫在
// QQ 原本那份 doc 的 authProviderId，doc id ≠ userId）。
// 少了第二段，綁定後的小孩在家長端會整個消失。
export async function resolveMemberUser(
  userId: string
): Promise<User | null> {
  const direct = await firestore().collection('users').doc(userId).get();
  if (direct.exists()) {
    return { id: direct.id, ...direct.data() } as User;
  }
  // Fallback：doc id ≠ userId 的舊資料。注意加固後 users list 規則只放行「查自己」
  // （authProviderId == 自己 uid），家長查小孩會 permission-denied。包起來降級成 null，
  // 讓呼叫端退回 fallback 顯示名，而不是整個成員/審核清單被拋錯炸掉。
  try {
    const q = await firestore()
      .collection('users')
      .where('authProviderId', '==', userId)
      .limit(1)
      .get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, ...d.data() } as User;
    }
  } catch (e) {
    console.warn('[memberName] fallback query blocked:', (e as any)?.code);
  }
  return null;
}

// 只有 userId 在手（review / notif / rewards 的 snapshot callback）時用：
// 一次解析出 family-scoped 顯示名與頭像。membership 與 user 並行查，
// 不增加序列延遲。
export async function resolveMemberDisplay(
  familyId: string,
  userId: string,
  fallback = '小朋友'
): Promise<{ name: string; avatar: string | null }> {
  const [memSnap, user] = await Promise.all([
    firestore()
      .collection('familyMemberships')
      .where('familyId', '==', familyId)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get(),
    resolveMemberUser(userId),
  ]);
  const membership = memSnap.empty
    ? null
    : (memSnap.docs[0].data() as FamilyMembership);
  return {
    name: memberName(membership, user, fallback),
    avatar: memberAvatar(membership),
  };
}
