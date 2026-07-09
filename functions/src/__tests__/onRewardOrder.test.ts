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
// A2：扣點金額的權威來源。每筆訂單對應一個 rewardItems doc。
async function seedRewardItem(itemId: string, familyId: string, pointCost: number, status = 'active') {
  await db().collection('rewardItems').doc(itemId).set({ familyId, pointCost, status, title: 'item' });
}
async function seedOrder(orderId: string, data: any) {
  await db().collection('rewardOrders').doc(orderId).set(data);
}

function fireCreated(orderId: string, data: any) {
  const snap = fft.firestore.makeDocumentSnapshot(data, `rewardOrders/${orderId}`);
  return fft.wrap(onRewardOrderCreated)({ data: snap, params: { orderId } } as any);
}
function fireRefund(orderId: string, data: any, toStatus: 'cancelled' | 'rejected' = 'cancelled', beforeStatus = 'pending') {
  const beforeSnap = fft.firestore.makeDocumentSnapshot({ ...data, status: beforeStatus }, `rewardOrders/${orderId}`);
  const afterSnap = fft.firestore.makeDocumentSnapshot({ ...data, status: toStatus }, `rewardOrders/${orderId}`);
  return fft.wrap(onRewardOrderCancelledOrRejected)({ data: { before: beforeSnap, after: afterSnap }, params: { orderId } } as any);
}

describe('onRewardOrderCreated (扣點)', () => {
  it('扣點從確定性錢包 {familyId}_{childId}，金額取自 rewardItems 權威售價', async () => {
    const familyId = 'f';
    await seedChildMembership('kid', familyId, 'kid');
    await seedWallet(familyId, 'kid', 100);
    await seedRewardItem('item-1', familyId, 30);
    const order = { userId: 'kid', familyId, itemId: 'item-1', pointCostSnapshot: 30, status: 'pending' };
    await seedOrder('ord-1', order);
    await fireCreated('ord-1', order);

    expect((await db().collection('pointWallets').doc(`${familyId}_kid`).get()).data()?.balance).toBe(70);
    const pt = await db().collection('pointTransactions').doc('reward_order_ord-1').get();
    expect(pt.data()).toMatchObject({ walletId: `${familyId}_kid`, delta: -30, sourceType: 'reward_order' });
    // BUG-06：訂單 doc 帶下單當時扣款前/後餘額快照，before - cost = after。
    const orderDoc = await db().collection('rewardOrders').doc('ord-1').get();
    expect(orderDoc.data()?.balanceBeforeSnapshot).toBe(100);
    expect(orderDoc.data()?.balanceAfterSnapshot).toBe(70);
  });

  // A2 核心回歸：client 謊報 pointCostSnapshot=1，但實際扣的是 item 權威售價 30。
  it('client 謊報便宜價 → 仍扣 rewardItems 權威售價（A2）', async () => {
    const familyId = 'fA2';
    await seedChildMembership('kidA2', familyId, 'kidA2');
    await seedWallet(familyId, 'kidA2', 100);
    await seedRewardItem('item-A2', familyId, 30); // 真實售價 30
    const order = { userId: 'kidA2', familyId, itemId: 'item-A2', pointCostSnapshot: 1, status: 'pending' }; // 謊報 1
    await seedOrder('ord-A2', order);
    await fireCreated('ord-A2', order);

    // 扣 30 不是 1
    expect((await db().collection('pointWallets').doc(`${familyId}_kidA2`).get()).data()?.balance).toBe(70);
    // 訂單 pointCostSnapshot 被正規化成權威售價
    expect((await db().collection('rewardOrders').doc('ord-A2').get()).data()?.pointCostSnapshot).toBe(30);
  });

  it('childId != userId → 扣 childId 錢包', async () => {
    const familyId = 'f2';
    await seedChildMembership('uidX', familyId, 'permX');
    await seedWallet(familyId, 'permX', 50);
    await seedRewardItem('item-2', familyId, 20);
    const order = { userId: 'uidX', familyId, itemId: 'item-2', pointCostSnapshot: 20, status: 'pending' };
    await seedOrder('ord-2', order);
    await fireCreated('ord-2', order);
    expect((await db().collection('pointWallets').doc(`${familyId}_permX`).get()).data()?.balance).toBe(30);
  });

  it('餘額不足 → 訂單 rejected、不扣點', async () => {
    const familyId = 'f3';
    await seedChildMembership('k3', familyId, 'k3');
    await seedWallet(familyId, 'k3', 10);
    await seedRewardItem('item-3', familyId, 50);
    const order = { userId: 'k3', familyId, itemId: 'item-3', pointCostSnapshot: 50, status: 'pending' };
    await seedOrder('ord-3', order);
    await fireCreated('ord-3', order);
    expect((await db().collection('rewardOrders').doc('ord-3').get()).data()?.status).toBe('rejected');
    expect((await db().collection('pointWallets').doc(`${familyId}_k3`).get()).data()?.balance).toBe(10);
  });

  it('重放扣點 → 不 double-deduct', async () => {
    const familyId = 'f4';
    await seedChildMembership('k4', familyId, 'k4');
    await seedWallet(familyId, 'k4', 100);
    await seedRewardItem('item-4', familyId, 25);
    const order = { userId: 'k4', familyId, itemId: 'item-4', pointCostSnapshot: 25, status: 'pending' };
    await seedOrder('ord-4', order);
    await fireCreated('ord-4', order);
    await fireCreated('ord-4', order);
    expect((await db().collection('pointWallets').doc(`${familyId}_k4`).get()).data()?.balance).toBe(75);
  });

  it('rewardItems 不存在 → reject、不扣點（A2）', async () => {
    const familyId = 'f5';
    await seedChildMembership('k5', familyId, 'k5');
    await seedWallet(familyId, 'k5', 100);
    // 不 seed item
    const order = { userId: 'k5', familyId, itemId: 'ghost-item', pointCostSnapshot: 10, status: 'pending' };
    await seedOrder('ord-5', order);
    await fireCreated('ord-5', order);
    expect((await db().collection('rewardOrders').doc('ord-5').get()).data()?.status).toBe('rejected');
    expect((await db().collection('pointWallets').doc(`${familyId}_k5`).get()).data()?.balance).toBe(100);
  });

  // R2-03 競態守衛：訂單在 trigger 執行前已被取消 → 不扣點。
  // 否則退款 trigger 因找不到扣款紀錄跳過退款，扣款 trigger 稍後照扣 → 點數遺失無帳可對。
  it('訂單在 trigger 前已 cancelled → 不扣點、不寫 pointTransaction、不寫快照欄位（R2-03）', async () => {
    const familyId = 'f7';
    await seedChildMembership('k7', familyId, 'k7');
    await seedWallet(familyId, 'k7', 100);
    await seedRewardItem('item-7', familyId, 20);
    const order = { userId: 'k7', familyId, itemId: 'item-7', pointCostSnapshot: 20, status: 'pending' };
    // doc 現況已是 cancelled（trigger 收到的仍是建立當下的 pending snapshot）
    await seedOrder('ord-7', { ...order, status: 'cancelled' });
    await fireCreated('ord-7', order);

    expect((await db().collection('pointWallets').doc(`${familyId}_k7`).get()).data()?.balance).toBe(100);
    expect((await db().collection('pointTransactions').doc('reward_order_ord-7').get()).exists).toBe(false);
    const orderDoc = (await db().collection('rewardOrders').doc('ord-7').get()).data();
    expect(orderDoc?.balanceBeforeSnapshot).toBeUndefined();
    expect(orderDoc?.balanceAfterSnapshot).toBeUndefined();
  });

  // R2-30：品項無效的 reject 路徑也要守衛——訂單已 cancelled 不得被蓋成 rejected。
  // （trigger 收到的是建立當下的 pending snapshot，但 doc 現況可能已被小孩取消。）
  it('訂單已 cancelled＋品項無效 → 維持 cancelled、不被蓋成 rejected（R2-30）', async () => {
    const familyId = 'f8';
    await seedChildMembership('k8', familyId, 'k8');
    await seedWallet(familyId, 'k8', 100);
    // 不 seed item（品項無效）
    const order = { userId: 'k8', familyId, itemId: 'ghost-item-8', pointCostSnapshot: 20, status: 'pending' };
    await seedOrder('ord-8', { ...order, status: 'cancelled' }); // doc 現況已 cancelled
    await fireCreated('ord-8', order);

    expect((await db().collection('rewardOrders').doc('ord-8').get()).data()?.status).toBe('cancelled');
    expect((await db().collection('pointWallets').doc(`${familyId}_k8`).get()).data()?.balance).toBe(100);
    expect((await db().collection('pointTransactions').doc('reward_order_ord-8').get()).exists).toBe(false);
  });

  // R2-21(P8) 防禦性測試：reject 路徑不寫餘額快照——client 端 hasSnapshot 判斷
  // 依賴「rejected 訂單沒有快照欄位」，一旦誤寫會讓審核 sheet 顯示錯誤餘額。
  it('餘額不足 rejected → 不寫 balanceBefore/AfterSnapshot 快照欄位（R2-21）', async () => {
    const familyId = 'f9';
    await seedChildMembership('k9', familyId, 'k9');
    await seedWallet(familyId, 'k9', 10);
    await seedRewardItem('item-9', familyId, 50);
    const order = { userId: 'k9', familyId, itemId: 'item-9', pointCostSnapshot: 50, status: 'pending' };
    await seedOrder('ord-9', order);
    await fireCreated('ord-9', order);

    const orderDoc = (await db().collection('rewardOrders').doc('ord-9').get()).data();
    expect(orderDoc?.status).toBe('rejected');
    expect(orderDoc?.balanceBeforeSnapshot).toBeUndefined();
    expect(orderDoc?.balanceAfterSnapshot).toBeUndefined();
  });

  // R2-21(P8) 防禦性測試：trigger 重放（Firestore trigger at-least-once）不得用
  // 重放當下的錢包餘額覆寫「下單當時」的快照——快照語意是歷史記錄，只能寫一次。
  it('replay（重複 trigger）→ 不覆寫既有餘額快照（R2-21）', async () => {
    const familyId = 'f10';
    await seedChildMembership('k10', familyId, 'k10');
    await seedWallet(familyId, 'k10', 100);
    await seedRewardItem('item-10', familyId, 25);
    const order = { userId: 'k10', familyId, itemId: 'item-10', pointCostSnapshot: 25, status: 'pending' };
    await seedOrder('ord-10', order);
    await fireCreated('ord-10', order); // 快照 100/75、餘額 75

    // 下單到重放之間小孩又賺了點（餘額改變），重放不得據此改寫快照
    await db().collection('pointWallets').doc(`${familyId}_k10`).update({ balance: 500 });
    await fireCreated('ord-10', order); // 重放

    const orderDoc = (await db().collection('rewardOrders').doc('ord-10').get()).data();
    expect(orderDoc?.balanceBeforeSnapshot).toBe(100);
    expect(orderDoc?.balanceAfterSnapshot).toBe(75);
    // 也不重複扣點
    expect((await db().collection('pointWallets').doc(`${familyId}_k10`).get()).data()?.balance).toBe(500);
  });

  it('rewardItems 已封存（archived）→ reject、不扣點（A2）', async () => {
    const familyId = 'f6';
    await seedChildMembership('k6', familyId, 'k6');
    await seedWallet(familyId, 'k6', 100);
    await seedRewardItem('item-6', familyId, 20, 'archived');
    const order = { userId: 'k6', familyId, itemId: 'item-6', pointCostSnapshot: 20, status: 'pending' };
    await seedOrder('ord-6', order);
    await fireCreated('ord-6', order);
    expect((await db().collection('rewardOrders').doc('ord-6').get()).data()?.status).toBe('rejected');
    expect((await db().collection('pointWallets').doc(`${familyId}_k6`).get()).data()?.balance).toBe(100);
  });
});

describe('onRewardOrderCancelledOrRejected (退款)', () => {
  it('退回原始扣款的 walletId — 即使 childId 之後變了', async () => {
    const familyId = 'g';
    await seedChildMembership('uidA', familyId, 'childA');
    await seedWallet(familyId, 'childA', 100);
    await seedRewardItem('item-g', familyId, 30);
    const order = { userId: 'uidA', familyId, itemId: 'item-g', pointCostSnapshot: 30, status: 'pending' };
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
    await seedRewardItem('item-g2', familyId, 40);
    const order = { userId: 'k', familyId, itemId: 'item-g2', pointCostSnapshot: 40, status: 'pending' };
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
    const order = { userId: 'k', familyId, itemId: 'item-g3', pointCostSnapshot: 40, status: 'pending' };
    await seedOrder('g3-ord', order);
    await fireRefund('g3-ord', order, 'rejected');
    expect((await db().collection('pointWallets').doc(`${familyId}_k`).get()).data()?.balance).toBe(100);
    expect((await db().collection('pointTransactions').doc('reward_refund_g3-ord').get()).exists).toBe(false);
  });

  // 防「領獎又退點」：已交付的訂單即使被改 cancelled 也不退款。
  it('已交付訂單被取消 → 不退款', async () => {
    const familyId = 'g4';
    await seedChildMembership('k', familyId, 'k');
    await seedWallet(familyId, 'k', 100);
    await seedRewardItem('item-g4', familyId, 40);
    const order = { userId: 'k', familyId, itemId: 'item-g4', pointCostSnapshot: 40, status: 'pending' };
    await seedOrder('g4-ord', order);
    await fireCreated('g4-ord', order); // 扣 40 → 60
    // before.status = delivered（已交付）→ cancelled，應該不退
    await fireRefund('g4-ord', order, 'cancelled', 'delivered');
    expect((await db().collection('pointWallets').doc(`${familyId}_k`).get()).data()?.balance).toBe(60);
    expect((await db().collection('pointTransactions').doc('reward_refund_g4-ord').get()).exists).toBe(false);
  });
});
