import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { onRewardOrderCreated } from '../onRewardOrderCreated';
import { onRewardOrderCancelledOrRejected } from '../onRewardOrderCancelledOrRejected';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

const db = () => admin.firestore();

async function seedChildMembership(uid: string, familyId: string, childId?: string) {
  await db()
    .collection('familyMemberships')
    .doc(`${uid}_${familyId}`)
    .set({ familyId, userId: uid, role: 'child', status: 'active', ...(childId !== undefined ? { childId } : {}) });
}
async function seedWallet(familyId: string, childId: string, balance: number) {
  await db().collection('pointWallets').doc(`${familyId}_${childId}`).set({ childId, userId: childId, familyId, balance });
}
async function seedOrder(orderId: string, data: any) {
  await db().collection('rewardOrders').doc(orderId).set(data);
}

function fireCreated(orderId: string, data: any) {
  const snap = fft.firestore.makeDocumentSnapshot(data, `rewardOrders/${orderId}`);
  return fft.wrap(onRewardOrderCreated)({ data: snap, params: { orderId } } as any);
}
function fireRefund(orderId: string, data: any, toStatus: 'cancelled' | 'rejected' = 'cancelled') {
  const beforeSnap = fft.firestore.makeDocumentSnapshot({ ...data, status: 'pending' }, `rewardOrders/${orderId}`);
  const afterSnap = fft.firestore.makeDocumentSnapshot({ ...data, status: toStatus }, `rewardOrders/${orderId}`);
  return fft.wrap(onRewardOrderCancelledOrRejected)({ data: { before: beforeSnap, after: afterSnap }, params: { orderId } } as any);
}

describe('onRewardOrderCreated (扣點)', () => {
  it('扣點從確定性錢包 {familyId}_{childId}，deduction tx id = reward_order_{orderId}', async () => {
    const familyId = 'f';
    await seedChildMembership('kid', familyId, 'kid');
    await seedWallet(familyId, 'kid', 100);
    const order = { userId: 'kid', familyId, pointCostSnapshot: 30, status: 'pending' };
    await seedOrder('ord-1', order);
    await fireCreated('ord-1', order);

    expect((await db().collection('pointWallets').doc(`${familyId}_kid`).get()).data()?.balance).toBe(70);
    const pt = await db().collection('pointTransactions').doc('reward_order_ord-1').get();
    expect(pt.data()).toMatchObject({ walletId: `${familyId}_kid`, delta: -30, sourceType: 'reward_order' });
  });

  it('childId != userId → 扣 childId 錢包', async () => {
    const familyId = 'f2';
    await seedChildMembership('uidX', familyId, 'permX');
    await seedWallet(familyId, 'permX', 50);
    const order = { userId: 'uidX', familyId, pointCostSnapshot: 20, status: 'pending' };
    await seedOrder('ord-2', order);
    await fireCreated('ord-2', order);
    expect((await db().collection('pointWallets').doc(`${familyId}_permX`).get()).data()?.balance).toBe(30);
  });

  it('餘額不足 → 訂單 rejected、不扣點', async () => {
    const familyId = 'f3';
    await seedChildMembership('k3', familyId, 'k3');
    await seedWallet(familyId, 'k3', 10);
    const order = { userId: 'k3', familyId, pointCostSnapshot: 50, status: 'pending' };
    await seedOrder('ord-3', order);
    await fireCreated('ord-3', order);
    expect((await db().collection('rewardOrders').doc('ord-3').get()).data()?.status).toBe('rejected');
    expect((await db().collection('pointWallets').doc(`${familyId}_k3`).get()).data()?.balance).toBe(10);
  });

  it('重放扣點 → 不 double-deduct', async () => {
    const familyId = 'f4';
    await seedChildMembership('k4', familyId, 'k4');
    await seedWallet(familyId, 'k4', 100);
    const order = { userId: 'k4', familyId, pointCostSnapshot: 25, status: 'pending' };
    await seedOrder('ord-4', order);
    await fireCreated('ord-4', order);
    await fireCreated('ord-4', order);
    expect((await db().collection('pointWallets').doc(`${familyId}_k4`).get()).data()?.balance).toBe(75);
  });

  it('pointCostSnapshot malformed → reject', async () => {
    const familyId = 'f5';
    await seedChildMembership('k5', familyId, 'k5');
    await seedWallet(familyId, 'k5', 100);
    const order = { userId: 'k5', familyId, pointCostSnapshot: NaN, status: 'pending' };
    await seedOrder('ord-5', order);
    await fireCreated('ord-5', order);
    expect((await db().collection('rewardOrders').doc('ord-5').get()).data()?.status).toBe('rejected');
    expect((await db().collection('pointWallets').doc(`${familyId}_k5`).get()).data()?.balance).toBe(100);
  });
});

describe('onRewardOrderCancelledOrRejected (退款)', () => {
  it('退回原始扣款的 walletId — 即使 childId 之後變了', async () => {
    const familyId = 'g';
    await seedChildMembership('uidA', familyId, 'childA');
    await seedWallet(familyId, 'childA', 100);
    const order = { userId: 'uidA', familyId, pointCostSnapshot: 30, status: 'pending' };
    await seedOrder('g-ord', order);
    await fireCreated('g-ord', order); // 扣到 g_childA → 70

    // 模擬 childId 變動（uid 重綁後權威 childId 改了）
    await seedChildMembership('uidA', familyId, 'childA_NEW');
    await seedWallet(familyId, 'childA_NEW', 0);

    await fireRefund('g-ord', order, 'cancelled');

    // 退回原錢包 g_childA（帳本權威），不是新的
    expect((await db().collection('pointWallets').doc(`${familyId}_childA`).get()).data()?.balance).toBe(100);
    expect((await db().collection('pointWallets').doc(`${familyId}_childA_NEW`).get()).data()?.balance).toBe(0);
    const refund = await db().collection('pointTransactions').doc('reward_refund_g-ord').get();
    expect(refund.data()).toMatchObject({ walletId: `${familyId}_childA`, delta: 30, sourceType: 'reward_refund' });
  });

  it('重放退款 → 不 double-refund', async () => {
    const familyId = 'g2';
    await seedChildMembership('k', familyId, 'k');
    await seedWallet(familyId, 'k', 100);
    const order = { userId: 'k', familyId, pointCostSnapshot: 40, status: 'pending' };
    await seedOrder('g2-ord', order);
    await fireCreated('g2-ord', order); // 60
    await fireRefund('g2-ord', order, 'cancelled'); // 100
    await fireRefund('g2-ord', order, 'cancelled'); // 仍 100
    expect((await db().collection('pointWallets').doc(`${familyId}_k`).get()).data()?.balance).toBe(100);
  });

  it('從沒扣過（無 deduction）→ 不退', async () => {
    const familyId = 'g3';
    await seedChildMembership('k', familyId, 'k');
    await seedWallet(familyId, 'k', 100);
    const order = { userId: 'k', familyId, pointCostSnapshot: 40, status: 'pending' };
    await seedOrder('g3-ord', order);
    await fireRefund('g3-ord', order, 'rejected');
    expect((await db().collection('pointWallets').doc(`${familyId}_k`).get()).data()?.balance).toBe(100);
    expect((await db().collection('pointTransactions').doc('reward_refund_g3-ord').get()).exists).toBe(false);
  });
});
