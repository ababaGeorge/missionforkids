import type { TaskInstance, TaskInstanceStatus } from '../types/models';

/**
 * 進行中的 instance 狀態：可被標 missed、頻率變更時可同步期限；approved/missed 是終態不在此列。
 * ⚠️ functions/scripts/core-loop-e2e.cjs 第 20 節有手抄鏡像（RN module 無法在 node 直跑）——
 * 改這份清單時必須同步改鏡像。
 */
export const IN_PROGRESS_STATUSES: readonly TaskInstanceStatus[] = [
  'pending',
  'submitted',
  'rejected',
];

const isInProgress = (s: TaskInstanceStatus) =>
  (IN_PROGRESS_STATUSES as readonly string[]).includes(s);

/**
 * 每個孩子挑一筆「代表 instance」：進行中優先、其次 approved 等終態、missed 墊底。
 * 舊資料可能同一孩子有多筆 instance（歷史 bug 造成的重複）——missed 墊底可避免
 * 把「已有 approved 紀錄的孩子」誤判成被移除而復活出第二筆可領點的 instance。
 */
export function representativeByUser(
  instances: TaskInstance[]
): Map<string, TaskInstance> {
  const rank = (s: TaskInstanceStatus): number =>
    isInProgress(s) ? 0 : s === 'missed' ? 2 : 1;
  const rep = new Map<string, TaskInstance>();
  for (const inst of instances) {
    const prev = rep.get(inst.userId);
    if (!prev || rank(inst.status) < rank(prev.status)) {
      rep.set(inst.userId, inst);
    }
  }
  return rep;
}

/**
 * 目前仍指派中的孩子（代表 instance 不是 missed）——編輯 modal 預選用。
 * missed = 被移除或三振出局：不預選，家長重新勾選才代表要復活；
 * 否則只改標題也會把移除過的孩子偷偷加回來。
 */
export function assignedUserIds(instances: TaskInstance[]): string[] {
  return [...representativeByUser(instances).entries()]
    .filter(([, inst]) => inst.status !== 'missed')
    .map(([userId]) => userId);
}

export type AssignmentPlan = {
  /** 建新 pending instance：全新指派的孩子，或 missed 但已有點數紀錄不能復活的孩子 */
  createFor: string[];
  /** missed（被移除/三振）且沒有點數紀錄的孩子重新勾選 → 復活成 pending 並重設期限 */
  revive: TaskInstance[];
  /** 頻率改變時，仍指派且進行中的 instance → 同步新期限 */
  syncPeriod: TaskInstance[];
  /** 被移除的孩子「進行中」的 instance → 標 missed（approved 等終態不動，保護點數帳本） */
  markMissed: TaskInstance[];
};

/** 家長編輯任務時的 instance 對帳計畫（純函式，方便單元測試）。 */
export function planAssignmentChanges(
  instances: TaskInstance[],
  assignees: string[],
  freqChanged: boolean
): AssignmentPlan {
  const rep = representativeByUser(instances);
  const plan: AssignmentPlan = {
    createFor: [],
    revive: [],
    syncPeriod: [],
    markMissed: [],
  };

  for (const userId of assignees) {
    const r = rep.get(userId);
    if (!r) {
      plan.createFor.push(userId);
    } else if (r.status === 'missed') {
      if (r.pointsAwarded != null) {
        // 舊 bug 遺留資料：approved 曾被覆寫成 missed，pointsAwarded 與確定性
        // ledger doc（task_completion_{instanceId}）都還在。若照常復活會把
        // pointsAwarded 清成 null，之後再核准時 Cloud Function 撞到既存
        // ledger doc 提前 return——這筆 instance 永遠發不了點。
        // 改建全新 instance（新 id = 新 ledger id），舊 doc 原樣保留當帳本歷史。
        plan.createFor.push(userId);
      } else {
        plan.revive.push(r);
      }
    } else if (freqChanged && isInProgress(r.status)) {
      plan.syncPeriod.push(r);
    }
  }

  for (const inst of instances) {
    if (!assignees.includes(inst.userId) && isInProgress(inst.status)) {
      plan.markMissed.push(inst);
    }
  }

  return plan;
}
