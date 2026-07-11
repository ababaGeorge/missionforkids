import firestore, {
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
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
 *
 * ⚠️ E2E 有手抄鏡像：functions/scripts/core-loop-e2e.cjs 第 20 節 markMissedGuarded
 * （RN module 無法在 node 直跑）——改本函式的守衛邏輯或寫入欄位時，必須同步改鏡像，
 * 否則 E2E 綠燈不再反映真實 client 行為。
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

// =============================================================================
// R3-4b：小孩提交任務的交易守衛（仿上方 updateInstanceIfStatusIn 的模式）。
// 原本 handleSubmit 用 batch 直寫：不重讀 task status、submissionCount 只靠
// 本地 state 防呆——家長剛封存任務（soft delete）後小孩仍能提交成功。
// 改為交易內重讀三件事，全過才寫入（submission 建檔＋instance 更新同交易，
// 維持原 batch 的原子性）：
//   1. instance 存在且 status 在提交允許的來源狀態（pending/rejected，同 rules 矩陣）
//   2. tasks/{taskId} 存在且 status !== 'archived'（不存在＝被移除，同樣擋）
//   3. submissionCount 未達上限（取代本地 state 防呆）
// 違反拋錯誤碼，UI 用 i18n 顯示文案後返回清單。
//
// 注意（R3-4 審查修正）：正式 firestore.rules 對「不存在的 doc」求值
// resource.data 會 error → client 的 tx.get() 直接收到 permission-denied，
// 拿不到 exists()==false 的快照。所以 INSTANCE_GONE 與「task 不存在 →
// TASK_ARCHIVED」兩個 exists 分支在線上硬刪場景到不了 client，屬防禦縱深
// （emulator / 單元測試 / 未來規則放寬時的保底）。線上硬刪由 UI 端把
// permission-denied 對應到同款「狀態已變」守衛文案（見 task/[id].tsx）。
// =============================================================================

/** 提交允許的來源狀態（與 firestore.rules 小孩提交轉移矩陣一致） */
export const SUBMIT_SOURCE_STATUSES: readonly TaskInstanceStatus[] = [
  'pending',
  'rejected',
];

export async function submitInstanceGuarded(params: {
  instanceId: string;
  taskId: string;
  /** 提交次數上限（交易內用重讀的 submissionCount 判斷） */
  maxSubmissions: number;
  /** 通過守衛後要寫入 instance 的欄位 */
  instanceFields: InstanceFields;
  /** 同交易內一併建立的 taskSubmissions doc（ref 由呼叫端先建好，之後還要拿 id 叫 AI） */
  submission?: {
    ref: FirebaseFirestoreTypes.DocumentReference;
    fields: InstanceFields;
  };
}): Promise<void> {
  const instanceRef = firestore()
    .collection('taskInstances')
    .doc(params.instanceId);
  const taskRef = firestore().collection('tasks').doc(params.taskId);
  await firestore().runTransaction(async (tx) => {
    // Firestore 交易規則：所有讀取必須在寫入之前
    const instSnap = await tx.get(instanceRef);
    if (!instSnap.exists()) throw new Error('INSTANCE_GONE');
    const data = instSnap.data() ?? {};
    const status = data.status as TaskInstanceStatus | undefined;
    if (!status || !SUBMIT_SOURCE_STATUSES.includes(status)) {
      // 開頁後狀態被動過（如家長編輯任務把 instance 標成 missed）
      throw new Error('INSTANCE_NOT_SUBMITTABLE');
    }
    if ((data.submissionCount || 0) >= params.maxSubmissions) {
      throw new Error('MAX_SUBMISSIONS');
    }
    const taskSnap = await tx.get(taskRef);
    if (!taskSnap.exists() || (taskSnap.data() ?? {}).status === 'archived') {
      throw new Error('TASK_ARCHIVED');
    }
    if (params.submission) tx.set(params.submission.ref, params.submission.fields);
    tx.update(instanceRef, params.instanceFields);
  });
}
