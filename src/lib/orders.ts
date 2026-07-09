import firestore from '@react-native-firebase/firestore';
import type { RewardOrderStatus } from '../types/models';

// =============================================================================
// R2-04 / R2-31：訂單狀態變更前的交易守衛（review / rewards 共用）
// 小孩取消訂單時 Cloud Function 已把點數退還；家長畫面殘留的舊卡片若仍能
// 裸 update 成 approved/rejected/delivered，會變成「點數已退卻照樣領獎」。
// 改用交易重讀：status 仍在允許的前置狀態集合內才寫入，否則拋帶錯誤碼的
// Error，由 UI 用 ORDER_STALE_MESSAGES 顯示友善訊息並讓列表刷新。
// =============================================================================

export const ORDER_STALE_MESSAGES: Record<string, string> = {
  ORDER_GONE: '這筆兌換申請已經不存在了。',
  ORDER_CANCELLED: '這筆兌換已被小孩取消，點數已退還，不用再處理囉。',
  ORDER_ALREADY_HANDLED: '這筆兌換已經處理過了，不能重複處理。',
};

/**
 * 交易內重讀訂單，僅當 status 在 allowedStatuses 內才寫入 fields；
 * 否則拋錯誤碼：不存在 → ORDER_GONE、已取消 → ORDER_CANCELLED、
 * 其餘非前置狀態 → ORDER_ALREADY_HANDLED。
 */
export async function updateOrderIfStatusIn(
  orderId: string,
  allowedStatuses: readonly RewardOrderStatus[],
  fields: Record<string, any>
): Promise<void> {
  const ref = firestore().collection('rewardOrders').doc(orderId);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('ORDER_GONE');
    const status = snap.data()?.status as RewardOrderStatus | undefined;
    if (!status || !allowedStatuses.includes(status)) {
      throw new Error(
        status === 'cancelled' ? 'ORDER_CANCELLED' : 'ORDER_ALREADY_HANDLED'
      );
    }
    tx.update(ref, fields);
  });
}

/** R2-04 原始用法：家長核准/婉拒前，訂單必須仍是 pending。 */
export const updateOrderIfPending = (
  orderId: string,
  fields: Record<string, any>
): Promise<void> => updateOrderIfStatusIn(orderId, ['pending'], fields);
