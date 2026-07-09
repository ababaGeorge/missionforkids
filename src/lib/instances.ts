import firestore from '@react-native-firebase/firestore';
import type { TaskInstanceStatus } from '../types/models';

// =============================================================================
// R2-FB：任務審核前的交易守衛（比照 orders.ts 的 updateOrderIfStatusIn）。
// 審核 sheet 的 activeTask 是開 sheet 當下的凍結快照——期間另一位家長可能
// 已把 submitted instance 標成 missed（如編輯任務移除小孩，R2-08 常規操作）。
// 裸 update 會把 missed 打穿成 approved，CF 照發點給已被移出的小孩。
// 改用交易重讀：status 仍在允許的前置狀態集合內才寫入，否則拋帶錯誤碼的
// Error，由 UI 用 INSTANCE_STALE_MESSAGES 顯示友善訊息並關 sheet 讓列表刷新。
// =============================================================================

export const INSTANCE_STALE_MESSAGES: Record<string, string> = {
  INSTANCE_GONE: '這筆任務紀錄已經不存在了，可能任務有異動。',
  INSTANCE_NOT_SUBMITTED: '這筆提交已經不是待審狀態（可能已處理過或任務有異動），不用再審囉。',
};

type InstanceFields = Record<string, any>;
/** 回呼版：拿到交易內重讀的 instance 資料，回傳要寫入的欄位。 */
type InstanceFieldsFn = (data: Record<string, any>) => InstanceFields;

/**
 * 交易內重讀 taskInstance，僅當 status 在 allowedStatuses 內才寫入；
 * 否則拋錯誤碼：不存在 → INSTANCE_GONE、非前置狀態 → INSTANCE_NOT_SUBMITTED。
 * fieldsOrFn 可傳固定欄位物件，或回呼（拿到重讀資料後回傳欄位）——
 * 三振計數等依賴 instance 現值的邏輯必須用回呼版，避免用到凍結快照。
 */
export async function updateInstanceIfStatusIn(
  instanceId: string,
  allowedStatuses: readonly TaskInstanceStatus[],
  fieldsOrFn: InstanceFields | InstanceFieldsFn
): Promise<void> {
  const ref = firestore().collection('taskInstances').doc(instanceId);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('INSTANCE_GONE');
    const data = snap.data() ?? {};
    const status = data.status as TaskInstanceStatus | undefined;
    if (!status || !allowedStatuses.includes(status)) {
      throw new Error('INSTANCE_NOT_SUBMITTED');
    }
    const fields =
      typeof fieldsOrFn === 'function' ? fieldsOrFn(data) : fieldsOrFn;
    tx.update(ref, fields);
  });
}
