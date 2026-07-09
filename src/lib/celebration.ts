import type { TaskInstanceStatus } from '../types/models';

export type CelebrationStep = {
  /** 是否觸發慶祝動畫（points 為要顯示的點數） */
  celebrate: boolean;
  points: number;
  /** 是否把 prevStatus 推進成本次 status；false = 點數未到位，等下次快照再判斷 */
  advance: boolean;
};

/**
 * 判斷一次 taskInstance 快照要不要觸發慶祝動畫。
 * 發點是 Cloud Function trigger 非同步補寫 pointsAwarded：快照常先看到
 * status='approved' 但 pointsAwarded 還沒到，若當下就慶祝會閃「+0」。
 * 因此點數未到位時不慶祝、也不推進 prevStatus——等 pointsAwarded 補到的
 * 那次快照才算完成一次轉換（仍只觸發一次、顯示正確點數）。
 */
export function celebrationStep(
  prevStatus: TaskInstanceStatus | undefined,
  status: TaskInstanceStatus,
  pointsAwarded: number | null | undefined
): CelebrationStep {
  if (status === 'approved' && pointsAwarded == null) {
    return { celebrate: false, points: 0, advance: false };
  }
  const celebrate =
    !!prevStatus && prevStatus !== 'approved' && status === 'approved';
  return { celebrate, points: pointsAwarded ?? 0, advance: true };
}
