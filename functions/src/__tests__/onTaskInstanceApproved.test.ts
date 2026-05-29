import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { onTaskInstanceApproved } from '../onTaskInstanceApproved';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

const db = () => admin.firestore();

async function seedTask(taskId: string, points: number) {
  await db().collection('tasks').doc(taskId).set({ points, title: 't' });
}
async function seedChildMembership(uid: string, familyId: string, childId?: string) {
  await db()
    .collection('familyMemberships')
    .doc(`${uid}_${familyId}`)
    .set({ familyId, userId: uid, role: 'child', status: 'active', ...(childId !== undefined ? { childId } : {}) });
}
async function seedInstance(id: string, data: any) {
  await db().collection('taskInstances').doc(id).set(data);
}

function fireApproved(id: string, afterData: any, beforeOverride: any = {}) {
  const beforeSnap = fft.firestore.makeDocumentSnapshot(
    { ...afterData, status: 'submitted', ...beforeOverride },
    `taskInstances/${id}`
  );
  const afterSnap = fft.firestore.makeDocumentSnapshot(
    { ...afterData, status: 'approved' },
    `taskInstances/${id}`
  );
  return fft.wrap(onTaskInstanceApproved)({
    data: { before: beforeSnap, after: afterSnap },
    params: { instanceId: id },
  } as any);
}

describe('onTaskInstanceApproved (childId 重構)', () => {
  it('approved → 點數進確定性錢包 {familyId}_{server解析childId}', async () => {
    const familyId = 'fam';
    await seedTask('task-1', 15);
    await seedChildMembership('kid', familyId, 'kid');
    const inst = { taskId: 'task-1', userId: 'kid', familyId, childId: 'kid', status: 'approved', pointsAwarded: null };
    await seedInstance('inst-1', inst);

    await fireApproved('inst-1', inst);

    const wallet = await db().collection('pointWallets').doc(`${familyId}_kid`).get();
    expect(wallet.data()?.balance).toBe(15);
    const inDoc = await db().collection('taskInstances').doc('inst-1').get();
    expect(inDoc.data()?.pointsAwarded).toBe(15);
  });

  it('childId != userId → 進 childId 錢包（server 重解析，不信任 doc 上的值）', async () => {
    const familyId = 'fam2';
    await seedTask('task-2', 10);
    await seedChildMembership('uidB', familyId, 'permB'); // 權威 childId = permB
    // doc 上 childId 故意寫錯成 'evil'，server 應忽略、用 membership 的 permB
    const inst = { taskId: 'task-2', userId: 'uidB', familyId, childId: 'evil', status: 'approved', pointsAwarded: null };
    await seedInstance('inst-2', inst);

    await fireApproved('inst-2', inst);

    expect((await db().collection('pointWallets').doc(`${familyId}_permB`).get()).data()?.balance).toBe(10);
    expect((await db().collection('pointWallets').doc(`${familyId}_evil`).get()).exists).toBe(false);
  });

  it('重放（pointsAwarded 已標記）→ 不 double-award', async () => {
    const familyId = 'fam3';
    await seedTask('task-3', 20);
    await seedChildMembership('kid3', familyId, 'kid3');
    const inst = { taskId: 'task-3', userId: 'kid3', familyId, childId: 'kid3', status: 'approved', pointsAwarded: null };
    await seedInstance('inst-3', inst);

    await fireApproved('inst-3', inst); // 第一次發點 → 標記 pointsAwarded
    // 模擬 trigger 重放：after payload 仍是 pointsAwarded:null，但實際 doc 已標記
    await fireApproved('inst-3', inst);

    expect((await db().collection('pointWallets').doc(`${familyId}_kid3`).get()).data()?.balance).toBe(20);
    const txs = await db().collection('pointTransactions').where('sourceType', '==', 'task_completion').get();
    expect(txs.size).toBe(1);
  });

  it('task.points malformed → log+skip，不炸錢包', async () => {
    const familyId = 'fam4';
    await seedTask('task-4', NaN as any);
    await seedChildMembership('kid4', familyId, 'kid4');
    const inst = { taskId: 'task-4', userId: 'kid4', familyId, childId: 'kid4', status: 'approved', pointsAwarded: null };
    await seedInstance('inst-4', inst);

    await fireApproved('inst-4', inst);
    expect((await db().collection('pointWallets').doc(`${familyId}_kid4`).get()).exists).toBe(false);
  });

  it('不寫 auto-id 錢包', async () => {
    const familyId = 'fam5';
    await seedTask('task-5', 5);
    await seedChildMembership('kid5', familyId, 'kid5');
    const inst = { taskId: 'task-5', userId: 'kid5', familyId, childId: 'kid5', status: 'approved', pointsAwarded: null };
    await seedInstance('inst-5', inst);
    await fireApproved('inst-5', inst);
    const wallets = await db().collection('pointWallets').where('familyId', '==', familyId).get();
    expect(wallets.size).toBe(1);
    expect(wallets.docs[0].id).toBe(`${familyId}_kid5`);
  });
});
