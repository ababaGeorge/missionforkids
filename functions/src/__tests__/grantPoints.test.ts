import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { grantPoints } from '../grantPoints';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

const db = () => admin.firestore();

async function seedParent(uid: string, familyId: string, status = 'active') {
  await db()
    .collection('familyMemberships')
    .doc(`${uid}_${familyId}`)
    .set({ familyId, userId: uid, role: 'parent', status });
}
async function seedChild(
  uid: string,
  familyId: string,
  childId?: string,
  status = 'active'
) {
  await db()
    .collection('familyMemberships')
    .doc(`${uid}_${familyId}`)
    .set({
      familyId,
      userId: uid,
      role: 'child',
      status,
      ...(childId !== undefined ? { childId } : {}),
    });
}

function call(uid: string, data: any) {
  return fft.wrap(grantPoints)({ data, auth: { uid, token: {} } } as any);
}

describe('grantPoints (childId 重構)', () => {
  it('家長給 30 → 寫進確定性錢包 {familyId}_{childId}，pointTransaction.walletId 為該 id', async () => {
    const familyId = 'fam';
    await seedParent('parent-1', familyId);
    await seedChild('child-uid', familyId, 'child-uid'); // childId == uid

    await call('parent-1', { childUserId: 'child-uid', familyId, amount: 30, reason: 'good' });

    const wallet = await db().collection('pointWallets').doc(`${familyId}_child-uid`).get();
    expect(wallet.exists).toBe(true);
    expect(wallet.data()).toMatchObject({ childId: 'child-uid', userId: 'child-uid', familyId, balance: 30 });

    const txs = await db().collection('pointTransactions').where('sourceType', '==', 'parent_grant').get();
    expect(txs.size).toBe(1);
    expect(txs.docs[0].data().walletId).toBe(`${familyId}_child-uid`);
  });

  it('childId != childUserId（換過 uid）→ 點數進 childId 錢包，不進 uid 錢包', async () => {
    const familyId = 'fam2';
    await seedParent('parent-2', familyId);
    await seedChild('new-uid', familyId, 'perm-child'); // childId 與 uid 不同

    await call('parent-2', { childUserId: 'new-uid', familyId, amount: 20, reason: '' });

    const childWallet = await db().collection('pointWallets').doc(`${familyId}_perm-child`).get();
    expect(childWallet.data()?.balance).toBe(20);
    const uidWallet = await db().collection('pointWallets').doc(`${familyId}_new-uid`).get();
    expect(uidWallet.exists).toBe(false);
  });

  it('扣點 clamp 到 0（不為負）', async () => {
    const familyId = 'fam3';
    await seedParent('p3', familyId);
    await seedChild('c3', familyId, 'c3');
    await call('p3', { childUserId: 'c3', familyId, amount: 10, reason: '' });
    await call('p3', { childUserId: 'c3', familyId, amount: -50, reason: '' });
    const wallet = await db().collection('pointWallets').doc(`${familyId}_c3`).get();
    expect(wallet.data()?.balance).toBe(0);
  });

  it('呼叫者不是家長 → permission-denied', async () => {
    const familyId = 'fam4';
    await seedChild('not-parent', familyId, 'not-parent');
    await seedChild('c4', familyId, 'c4');
    await expect(
      call('not-parent', { childUserId: 'c4', familyId, amount: 10, reason: '' })
    ).rejects.toThrow(/permission-denied|Only active parents/i);
  });

  it('小孩不是該家庭成員 → not-found / 拋錯，且不寫錢包', async () => {
    const familyId = 'fam5';
    await seedParent('p5', familyId);
    await expect(
      call('p5', { childUserId: 'ghost', familyId, amount: 10, reason: '' })
    ).rejects.toThrow();
    const wallets = await db().collection('pointWallets').where('familyId', '==', familyId).get();
    expect(wallets.size).toBe(0);
  });

  it('amount 非整數 / NaN → invalid-argument', async () => {
    const familyId = 'fam6';
    await seedParent('p6', familyId);
    await seedChild('c6', familyId, 'c6');
    await expect(
      call('p6', { childUserId: 'c6', familyId, amount: 1.5, reason: '' })
    ).rejects.toThrow(/invalid-argument|整數/i);
  });

  it('被移除的家長（status=removed，role 仍 parent）→ permission-denied，不寫錢包', async () => {
    const familyId = 'fam-removed-parent';
    await seedParent('ex-parent', familyId, 'removed');
    await seedChild('c8', familyId, 'c8');
    await expect(
      call('ex-parent', { childUserId: 'c8', familyId, amount: 10, reason: '' })
    ).rejects.toThrow(/permission-denied|active parent/i);
    const wallets = await db().collection('pointWallets').where('familyId', '==', familyId).get();
    expect(wallets.size).toBe(0);
  });

  it('收點對象是被移除的小孩（status=removed）→ 拋錯，不寫錢包', async () => {
    const familyId = 'fam-removed-child';
    await seedParent('p9', familyId);
    await seedChild('removed-kid', familyId, 'removed-kid', 'removed');
    await expect(
      call('p9', { childUserId: 'removed-kid', familyId, amount: 10, reason: '' })
    ).rejects.toThrow(/not-found|active member/i);
    const wallets = await db().collection('pointWallets').where('familyId', '==', familyId).get();
    expect(wallets.size).toBe(0);
  });

  it('收點對象不是小孩（role=parent）→ 拋錯，不寫錢包', async () => {
    const familyId = 'fam-grant-to-parent';
    await seedParent('p10', familyId);
    await seedParent('co-parent', familyId); // 另一位家長被指定為收點對象
    await expect(
      call('p10', { childUserId: 'co-parent', familyId, amount: 10, reason: '' })
    ).rejects.toThrow(/not-found|active member/i);
    const wallets = await db().collection('pointWallets').where('familyId', '==', familyId).get();
    expect(wallets.size).toBe(0);
  });

  it('回傳 delta：正常給 10 → delta === 10', async () => {
    const familyId = 'fam-delta-give';
    await seedParent('pd1', familyId);
    await seedChild('cd1', familyId, 'cd1');
    const res = await call('pd1', { childUserId: 'cd1', familyId, amount: 10, reason: '' });
    expect(res).toMatchObject({ success: true, delta: 10 });
  });

  it('回傳 delta：餘額 40 扣 999 → delta === -40（clamp 後實際扣除值）', async () => {
    const familyId = 'fam-delta-clamp';
    await seedParent('pd2', familyId);
    await seedChild('cd2', familyId, 'cd2');
    await call('pd2', { childUserId: 'cd2', familyId, amount: 40, reason: '' });
    const res = await call('pd2', { childUserId: 'cd2', familyId, amount: -999, reason: '' });
    expect(res.success).toBe(true);
    expect(res.delta).toBe(-40);
    const wallet = await db().collection('pointWallets').doc(`${familyId}_cd2`).get();
    expect(wallet.data()?.balance).toBe(0);
  });

  it('同 idempotencyKey 重放 → success true 且 delta null，餘額不重複變動', async () => {
    const familyId = 'fam-delta-idem';
    await seedParent('pd3', familyId);
    await seedChild('cd3', familyId, 'cd3');
    const key = 'replay-key-1';
    const first = await call('pd3', {
      childUserId: 'cd3',
      familyId,
      amount: 10,
      reason: '',
      idempotencyKey: key,
    });
    expect(first).toMatchObject({ success: true, delta: 10 });
    const replay = await call('pd3', {
      childUserId: 'cd3',
      familyId,
      amount: 10,
      reason: '',
      idempotencyKey: key,
    });
    expect(replay.success).toBe(true);
    expect(replay.delta).toBeNull();
    const wallet = await db().collection('pointWallets').doc(`${familyId}_cd3`).get();
    expect(wallet.data()?.balance).toBe(10);
  });

  it('不寫任何 auto-id 錢包（doc id 一律 {familyId}_{childId}）', async () => {
    const familyId = 'fam7';
    await seedParent('p7', familyId);
    await seedChild('c7', familyId, 'c7');
    await call('p7', { childUserId: 'c7', familyId, amount: 5, reason: '' });
    const wallets = await db().collection('pointWallets').where('familyId', '==', familyId).get();
    expect(wallets.size).toBe(1);
    expect(wallets.docs[0].id).toBe(`${familyId}_c7`);
  });
});
