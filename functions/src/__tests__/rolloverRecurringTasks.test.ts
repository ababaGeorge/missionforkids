import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { rolloverRecurringTasks, computeNextDue } from '../lib/recurrence';

const db = () => admin.firestore();

const FAMILY = 'famR';
const KID = 'kidR';

async function seedTask(id: string, data: any) {
  await db().collection('tasks').doc(id).set({
    familyId: FAMILY,
    title: 't',
    points: 10,
    status: 'active',
    graceDays: 2,
    ...data,
  });
}

async function seedInstance(id: string, data: any) {
  await db().collection('taskInstances').doc(id).set({
    userId: KID,
    childId: KID,
    familyId: FAMILY,
    submissionCount: 0,
    reviewedBy: null,
    reviewedAt: null,
    pointsAwarded: null,
    ...data,
  });
}

// rollover 現在會查 familyMemberships/{userId}_{familyId} 確認 active，非 active 直接 skip。
// 各測試若要覆蓋原情境（推進週期），需先造對應的 active membership。
async function seedMembership(
  userId: string,
  status: 'active' | 'removed' = 'active',
  familyId: string = FAMILY
) {
  await db().collection('familyMemberships').doc(`${userId}_${familyId}`).set({
    familyId,
    userId,
    childId: userId,
    role: 'child',
    status,
  });
}

async function instancesFor(taskId: string) {
  const snap = await db().collection('taskInstances').where('taskId', '==', taskId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

// 上一期截止日：now 之前，補交期也已過
const PREV_DUE = new Date('2026-03-10T23:59:00');
const GRACE_END = new Date('2026-03-12T23:59:00'); // +2 天
const NOW = new Date('2026-03-13T00:10:00'); // 補交期已過

describe('computeNextDue', () => {
  it('daily → +1 天', () => {
    expect(computeNextDue('daily', new Date('2026-03-10T23:59:00'))?.toISOString())
      .toBe(new Date('2026-03-11T23:59:00').toISOString());
  });
  it('weekly → +7 天（保留星期）', () => {
    const next = computeNextDue('weekly', new Date('2026-03-10T23:59:00'))!;
    expect(next.getDate()).toBe(17);
    expect(next.getDay()).toBe(new Date('2026-03-10T23:59:00').getDay());
  });
  it('monthly 月中同號', () => {
    const next = computeNextDue('monthly', new Date('2026-03-15T23:59:00'))!;
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3); // April
    expect(next.getDate()).toBe(15);
  });
  it('monthly 月底 Jan31 → Feb28 → Mar31（eom 語意）', () => {
    const feb = computeNextDue('monthly', new Date('2026-01-31T23:59:00'))!;
    expect(feb.getMonth()).toBe(1); // Feb
    expect(feb.getDate()).toBe(28); // 2026 非閏年
    const mar = computeNextDue('monthly', feb)!;
    expect(mar.getMonth()).toBe(2); // March
    expect(mar.getDate()).toBe(31); // 月底語意延續
  });
  it('once → null', () => {
    expect(computeNextDue('once' as any, new Date())).toBeNull();
  });
});

describe('rolloverRecurringTasks', () => {
  it('pending 過補交期 → 標 missed，並建下一期 daily', async () => {
    await seedMembership(KID);
    await seedTask('t1', { frequency: 'daily' });
    await seedInstance('t1i1', {
      taskId: 't1',
      status: 'pending',
      periodStart: Timestamp.fromDate(new Date('2026-03-09T23:59:00')),
      periodEnd: Timestamp.fromDate(PREV_DUE),
      gracePeriodEnd: Timestamp.fromDate(GRACE_END),
    });

    const res = await rolloverRecurringTasks(db(), NOW);
    expect(res).toEqual({ created: 1, missed: 1 });

    const list = await instancesFor('t1');
    const old = list.find((i) => i.id === 't1i1');
    expect(old.status).toBe('missed');
    const next = list.find((i) => i.id !== 't1i1');
    expect(next.status).toBe('pending');
    expect(next.periodEnd.toDate().toISOString())
      .toBe(new Date('2026-03-11T23:59:00').toISOString());
  });

  it('submitted（審核中）過補交期 → 不標 missed，但仍建下一期', async () => {
    await seedMembership(KID);
    await seedTask('t2', { frequency: 'daily' });
    await seedInstance('t2i1', {
      taskId: 't2',
      status: 'submitted',
      periodStart: Timestamp.fromDate(new Date('2026-03-09T23:59:00')),
      periodEnd: Timestamp.fromDate(PREV_DUE),
      gracePeriodEnd: Timestamp.fromDate(GRACE_END),
    });

    const res = await rolloverRecurringTasks(db(), NOW);
    expect(res.created).toBe(1);
    expect(res.missed).toBe(0);
    const list = await instancesFor('t2');
    expect(list.find((i) => i.id === 't2i1').status).toBe('submitted');
  });

  it('冪等：連跑兩次不重建下一期', async () => {
    await seedMembership(KID);
    await seedTask('t3', { frequency: 'daily' });
    await seedInstance('t3i1', {
      taskId: 't3',
      status: 'approved',
      periodStart: Timestamp.fromDate(new Date('2026-03-09T23:59:00')),
      periodEnd: Timestamp.fromDate(PREV_DUE),
      gracePeriodEnd: Timestamp.fromDate(GRACE_END),
    });

    await rolloverRecurringTasks(db(), NOW);
    const res2 = await rolloverRecurringTasks(db(), NOW);
    expect(res2.created).toBe(0);
    const list = await instancesFor('t3');
    expect(list.length).toBe(2); // 原本 1 + 新建 1，不重複
  });

  it('once 不重生', async () => {
    await seedMembership(KID);
    await seedTask('t4', { frequency: 'once' });
    await seedInstance('t4i1', {
      taskId: 't4',
      status: 'approved',
      periodStart: Timestamp.fromDate(new Date('2026-03-09T23:59:00')),
      periodEnd: Timestamp.fromDate(PREV_DUE),
      gracePeriodEnd: Timestamp.fromDate(GRACE_END),
    });
    const res = await rolloverRecurringTasks(db(), NOW);
    expect(res).toEqual({ created: 0, missed: 0 });
  });

  it('archived 任務跳過（等同停止週期）', async () => {
    await seedTask('t5', { frequency: 'daily', status: 'archived' });
    await seedInstance('t5i1', {
      taskId: 't5',
      status: 'pending',
      periodStart: Timestamp.fromDate(new Date('2026-03-09T23:59:00')),
      periodEnd: Timestamp.fromDate(PREV_DUE),
      gracePeriodEnd: Timestamp.fromDate(GRACE_END),
    });
    const res = await rolloverRecurringTasks(db(), NOW);
    expect(res).toEqual({ created: 0, missed: 0 });
    const list = await instancesFor('t5');
    expect(list[0].status).toBe('pending'); // 未被動到
  });

  it('本期補交期尚未結束 → 不動作', async () => {
    await seedMembership(KID);
    await seedTask('t6', { frequency: 'daily' });
    await seedInstance('t6i1', {
      taskId: 't6',
      status: 'pending',
      periodStart: Timestamp.fromDate(new Date('2026-03-12T23:59:00')),
      periodEnd: Timestamp.fromDate(new Date('2026-03-13T23:59:00')),
      gracePeriodEnd: Timestamp.fromDate(new Date('2026-03-15T23:59:00')),
    });
    const res = await rolloverRecurringTasks(db(), NOW);
    expect(res).toEqual({ created: 0, missed: 0 });
  });

  it('已移除成員：過期 pending 不標 missed、也不建下一期（幽靈任務防線）', async () => {
    const REMOVED_KID = 'kidGhost';
    await seedMembership(REMOVED_KID, 'removed');
    await seedTask('t7', { frequency: 'daily' });
    await seedInstance('t7i1', {
      taskId: 't7',
      userId: REMOVED_KID,
      childId: REMOVED_KID,
      status: 'pending',
      periodStart: Timestamp.fromDate(new Date('2026-03-09T23:59:00')),
      periodEnd: Timestamp.fromDate(PREV_DUE),
      gracePeriodEnd: Timestamp.fromDate(GRACE_END),
    });

    const res = await rolloverRecurringTasks(db(), NOW);
    expect(res).toEqual({ created: 0, missed: 0 });

    const list = await instancesFor('t7');
    expect(list.length).toBe(1); // 沒建下一期
    expect(list[0].status).toBe('pending'); // 舊 instance 沒被標 missed
  });
});
