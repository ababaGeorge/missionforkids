import {
  assignedUserIds,
  planAssignmentChanges,
} from '../taskAssignments';
import type { TaskInstance, TaskInstanceStatus } from '../../types/models';

const inst = (
  id: string,
  userId: string,
  status: TaskInstanceStatus,
  pointsAwarded: number | null = null
): TaskInstance =>
  ({
    id,
    taskId: 't1',
    userId,
    familyId: 'f1',
    periodStart: {} as any,
    periodEnd: {} as any,
    gracePeriodEnd: {} as any,
    status,
    submissionCount: 0,
    reviewedBy: null,
    reviewedAt: null,
    pointsAwarded,
  } as TaskInstance);

describe('assignedUserIds（編輯 modal 預選）', () => {
  it('missed（被移除/三振）不預選，其他狀態都算指派中', () => {
    const list = [
      inst('i1', 'kid-a', 'pending'),
      inst('i2', 'kid-b', 'approved'),
      inst('i3', 'kid-c', 'missed'),
    ];
    expect(assignedUserIds(list)).toEqual(['kid-a', 'kid-b']);
  });

  it('同孩子有 approved + missed 重複資料 → 仍算指派中（不因 missed 被剔除）', () => {
    const list = [
      inst('i1', 'kid-a', 'missed'),
      inst('i2', 'kid-a', 'approved'),
    ];
    expect(assignedUserIds(list)).toEqual(['kid-a']);
  });
});

describe('planAssignmentChanges（家長編輯任務的 instance 對帳）', () => {
  it('只改標題（指派、頻率都沒變）→ 四個清單全空，不動任何 instance', () => {
    const list = [
      inst('i1', 'kid-a', 'pending'),
      inst('i2', 'kid-b', 'approved'),
    ];
    const plan = planAssignmentChanges(list, ['kid-a', 'kid-b'], false);
    expect(plan).toEqual({
      createFor: [],
      revive: [],
      syncPeriod: [],
      markMissed: [],
    });
  });

  it('全新指派的孩子 → createFor', () => {
    const plan = planAssignmentChanges(
      [inst('i1', 'kid-a', 'pending')],
      ['kid-a', 'kid-new'],
      false
    );
    expect(plan.createFor).toEqual(['kid-new']);
    expect(plan.revive).toEqual([]);
  });

  it('移除孩子：只有進行中的標 missed，approved 的歷史不動', () => {
    const list = [
      inst('i1', 'kid-a', 'pending'),
      inst('i2', 'kid-b', 'approved'),
      inst('i3', 'kid-c', 'submitted'),
    ];
    const plan = planAssignmentChanges(list, [], false);
    expect(plan.markMissed.map((i) => i.id)).toEqual(['i1', 'i3']);
  });

  it('missed 的孩子重新勾選 → 復活（revive），不再永卡 missed', () => {
    const list = [inst('i1', 'kid-a', 'missed')];
    const plan = planAssignmentChanges(list, ['kid-a'], false);
    expect(plan.revive.map((i) => i.id)).toEqual(['i1']);
    expect(plan.createFor).toEqual([]);
  });

  it('missed 但已有點數紀錄（舊 bug 把 approved 覆寫成 missed）→ 不復活，建全新 instance', () => {
    // 復活會清 pointsAwarded，之後核准撞既存確定性 ledger doc 提前 return → 永遠發不了點。
    const list = [inst('i1', 'kid-a', 'missed', 10)];
    const plan = planAssignmentChanges(list, ['kid-a'], false);
    expect(plan.revive).toEqual([]);
    expect(plan.createFor).toEqual(['kid-a']);
  });

  it('同孩子有 approved + missed 重複資料 → 不復活（保護點數帳本，不生第二筆可領點 instance）', () => {
    const list = [
      inst('i1', 'kid-a', 'missed'),
      inst('i2', 'kid-a', 'approved'),
    ];
    const plan = planAssignmentChanges(list, ['kid-a'], false);
    expect(plan.revive).toEqual([]);
    expect(plan.createFor).toEqual([]);
  });

  it('全 missed + 空指派（編輯模式維持現狀路徑）→ 四個清單全空，不動任何 instance', () => {
    const list = [
      inst('i1', 'kid-a', 'missed'),
      inst('i2', 'kid-b', 'missed'),
    ];
    const plan = planAssignmentChanges(list, [], false);
    expect(plan).toEqual({
      createFor: [],
      revive: [],
      syncPeriod: [],
      markMissed: [],
    });
  });

  it('頻率改變 → 進行中 instance 同步期限（syncPeriod），approved 不動', () => {
    const list = [
      inst('i1', 'kid-a', 'pending'),
      inst('i2', 'kid-b', 'approved'),
    ];
    const plan = planAssignmentChanges(list, ['kid-a', 'kid-b'], true);
    expect(plan.syncPeriod.map((i) => i.id)).toEqual(['i1']);
  });

  it('頻率沒變 → 不同步期限', () => {
    const plan = planAssignmentChanges(
      [inst('i1', 'kid-a', 'pending')],
      ['kid-a'],
      false
    );
    expect(plan.syncPeriod).toEqual([]);
  });
});
