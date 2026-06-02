import firestore from '@react-native-firebase/firestore';
import { User } from '../types/models';

/**
 * 確定性錢包 doc id：pointWallets/{familyId}_{childId}。
 * 只「組」字串，從不反向解析（避免分隔符歧義）。
 */
export function walletDocId(familyId: string, childId: string): string {
  return `${familyId}_${childId}`;
}

/**
 * 從已載入的 user（useAuth 提供）解析自己的 childId。
 * user.childId 是權威（acceptFamilyInvite 與 membership 同步寫入）；
 * 舊帳號沒有 childId 欄位 → fallback 用 uid。
 */
export function childIdFor(user: Pick<User, 'childId'> | null | undefined, uid: string): string {
  return user?.childId ?? uid;
}

/**
 * 給只有 uid（沒有 user 物件）的呼叫端：讀 users/{uid}.childId ?? uid。
 */
export async function resolveMyChildId(uid: string): Promise<string> {
  const snap = await firestore().collection('users').doc(uid).get();
  const childId = (snap.data() as { childId?: string } | undefined)?.childId;
  return childId ?? uid;
}
