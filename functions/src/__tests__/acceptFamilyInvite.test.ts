import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import functionsTest from 'firebase-functions-test';
import { acceptFamilyInvite } from '../acceptFamilyInvite';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

async function seedInvite(
  inviteId: string,
  familyId: string,
  overrides: Record<string, any> = {}
) {
  const db = admin.firestore();
  await db.collection('familyInvites').doc(inviteId).set({
    email: 'kid@example.com',
    familyId,
    role: 'child',
    invitedBy: 'parent-1',
    status: 'pending',
    childProfile: { displayName: '小明', nickname: '阿明', avatarEmoji: '🦊' },
    acceptedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    ...overrides,
  });
}

describe('acceptFamilyInvite', () => {
  it('小孩接受 → 建 child user + childId membership + 確定性錢包，標記 accepted', async () => {
    const uid = 'child-uid-1';
    const familyId = 'fam-1';
    await seedInvite('inv-1', familyId);

    const res: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-1' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);

    expect(res.familyId).toBe(familyId);
    expect(res.childId).toBe(uid);

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()).toMatchObject({
      roleType: 'child',
      childId: uid,
      email: 'kid@example.com',
      authProvider: 'password',
    });

    const memDoc = await db.collection('familyMemberships').doc(`${uid}_${familyId}`).get();
    expect(memDoc.data()).toMatchObject({
      userId: uid,
      childId: uid,
      role: 'child',
      status: 'active',
      familyId,
      nickname: '阿明',
      avatarEmoji: '🦊',
    });

    const walletDoc = await db.collection('pointWallets').doc(`${familyId}_${uid}`).get();
    expect(walletDoc.data()).toMatchObject({
      childId: uid,
      userId: uid,
      familyId,
      balance: 0,
    });

    const invDoc = await db.collection('familyInvites').doc('inv-1').get();
    expect(invDoc.data()).toMatchObject({ status: 'accepted', acceptedBy: uid });
  });

  it('未登入 → unauthenticated', async () => {
    await seedInvite('inv-2', 'fam-2');
    await expect(
      fft.wrap(acceptFamilyInvite)({ data: { inviteId: 'inv-2' } } as any)
    ).rejects.toThrow(/unauthenticated/i);
  });

  it('invite 不存在 → not-found INVALID_INVITE', async () => {
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'nope' },
        auth: { uid: 'c', token: {} },
      } as any)
    ).rejects.toThrow(/INVALID_INVITE/);
  });

  it('invite 已過期 → failed-precondition INVITE_EXPIRED', async () => {
    await seedInvite('inv-3', 'fam-3', {
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
    });
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-3' },
        auth: { uid: 'c', token: {} },
      } as any)
    ).rejects.toThrow(/INVITE_EXPIRED/);
  });

  it('冪等：同一個 uid 再呼叫回傳既有、不報錯', async () => {
    const uid = 'child-uid-4';
    const familyId = 'fam-4';
    await seedInvite('inv-4', familyId);
    const first: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-4' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);
    const second: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-4' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);
    expect(second).toEqual(first);
  });

  // R3-3：removeFamilyMember 作廢的邀請不可再被接受。
  // 現況「非 pending 即擋」自動涵蓋 revoked——本案例把這個涵蓋釘進測試，防未來改成枚舉比對漏掉。
  it('R3-3：invite 已被作廢（revoked）→ failed-precondition INVITE_ALREADY_USED', async () => {
    await seedInvite('inv-13', 'fam-13', {
      status: 'revoked',
      revokedAt: FieldValue.serverTimestamp(),
      revokedBy: 'parent-1',
    });
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-13' },
        auth: { uid: 'child-uid-13', token: { email: 'kid@example.com' } },
      } as any)
    ).rejects.toThrow(/INVITE_ALREADY_USED/);

    const db = admin.firestore();
    // 不得建出 membership / 錢包；invite 維持 revoked
    const mem = await db.collection('familyMemberships').doc('child-uid-13_fam-13').get();
    expect(mem.exists).toBe(false);
    const invDoc = await db.collection('familyInvites').doc('inv-13').get();
    expect(invDoc.data()!.status).toBe('revoked');
  });

  it('invite 已被別人接受 → failed-precondition INVITE_ALREADY_USED', async () => {
    await seedInvite('inv-5', 'fam-5', { status: 'accepted', acceptedBy: 'someone-else' });
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-5' },
        auth: { uid: 'different-child', token: {} },
      } as any)
    ).rejects.toThrow(/INVITE_ALREADY_USED/);
  });

  it('email 與邀請不符 → permission-denied INVITE_EMAIL_MISMATCH', async () => {
    await seedInvite('inv-6', 'fam-6'); // invite.email = 'kid@example.com'
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-6' },
        auth: { uid: 'wrong-kid', token: { email: 'someone-else@example.com' } },
      } as any)
    ).rejects.toThrow(/INVITE_EMAIL_MISMATCH/);
  });

  it('重複接受第二張邀請 → 錢包餘額不歸零、暱稱不被覆寫、invite 標 accepted', async () => {
    const uid = 'child-uid-7';
    const familyId = 'fam-7';
    await seedInvite('inv-7a', familyId);
    await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-7a' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);

    const db = admin.firestore();
    // 模擬小孩已賺到 20 點
    await db.collection('pointWallets').doc(`${familyId}_${uid}`).update({ balance: 20 });

    // 家長對同一 email 再開一張邀請（帶不同 childProfile）
    await seedInvite('inv-7b', familyId, {
      childProfile: { displayName: '新名字', nickname: '新暱稱', avatarEmoji: '🐰' },
    });
    const res: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-7b' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);
    expect(res).toEqual({ familyId, childId: uid });

    const walletDoc = await db.collection('pointWallets').doc(`${familyId}_${uid}`).get();
    expect(walletDoc.data()!.balance).toBe(20); // 絕不重設

    const memDoc = await db.collection('familyMemberships').doc(`${uid}_${familyId}`).get();
    expect(memDoc.data()).toMatchObject({ nickname: '阿明', avatarEmoji: '🦊', status: 'active' });

    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()!.displayName).toBe('小明');

    const invDoc = await db.collection('familyInvites').doc('inv-7b').get();
    expect(invDoc.data()).toMatchObject({ status: 'accepted', acceptedBy: uid });
  });

  it('被移除的成員重新受邀 → membership 回 active、childId 不變、餘額保留、invite 標 accepted', async () => {
    const uid = 'child-uid-9';
    const familyId = 'fam-9';
    await seedInvite('inv-9a', familyId);
    await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-9a' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);

    const db = admin.firestore();
    // 小孩已賺到 20 點，之後被家長移除（鏡像 removeFamilyMember 的寫入：status＋審計欄）
    await db.collection('pointWallets').doc(`${familyId}_${uid}`).update({ balance: 20 });
    await db.collection('familyMemberships').doc(`${uid}_${familyId}`).update({
      status: 'removed',
      removedAt: FieldValue.serverTimestamp(),
      removedBy: 'parent-uid-9',
    });

    // 家長對同一 email 再開一張邀請
    await seedInvite('inv-9b', familyId);
    const res: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-9b' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);
    expect(res).toEqual({ familyId, childId: uid });

    const memDoc = await db.collection('familyMemberships').doc(`${uid}_${familyId}`).get();
    expect(memDoc.data()).toMatchObject({ status: 'active', childId: uid, userId: uid });
    // reactivate 必須清掉移除審計欄（否則 active doc 帶著 removedAt，審計語意矛盾）
    expect(memDoc.data()!.removedAt).toBeUndefined();
    expect(memDoc.data()!.removedBy).toBeUndefined();

    const walletDoc = await db.collection('pointWallets').doc(`${familyId}_${uid}`).get();
    expect(walletDoc.data()!.balance).toBe(20); // 點數保留

    const invDoc = await db.collection('familyInvites').doc('inv-9b').get();
    expect(invDoc.data()).toMatchObject({ status: 'accepted', acceptedBy: uid });
  });

  // R3-1 補充：「無任何 membership → 過」由第一個案例覆蓋、「同家庭非 active reactivate → 過」
  // 由上面 inv-9 案例覆蓋（兩者都會經過新守衛的查詢）。以下兩案例補跨家庭正反面。
  it('R3-1：已是別的家庭 active 成員 → 接新家庭邀請被擋 ALREADY_IN_FAMILY，invite 不被消耗', async () => {
    const uid = 'child-uid-11';
    await seedInvite('inv-11a', 'fam-11a');
    await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-11a' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);

    // 家庭 B 對同一 email 開邀請
    await seedInvite('inv-11b', 'fam-11b');
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-11b' },
        auth: { uid, token: { email: 'kid@example.com' } },
      } as any)
    ).rejects.toThrow(/ALREADY_IN_FAMILY/);

    const db = admin.firestore();
    // 交易整體回滾：家庭 B 不得殘留 membership / 錢包，invite 維持 pending
    const memB = await db.collection('familyMemberships').doc(`${uid}_fam-11b`).get();
    expect(memB.exists).toBe(false);
    const walletB = await db.collection('pointWallets').doc(`fam-11b_${uid}`).get();
    expect(walletB.exists).toBe(false);
    const invDoc = await db.collection('familyInvites').doc('inv-11b').get();
    expect(invDoc.data()!.status).toBe('pending');
  });

  it('R3-1：舊家庭 membership 已 removed（非 active）→ 接新家庭邀請可過', async () => {
    const uid = 'child-uid-12';
    await seedInvite('inv-12a', 'fam-12a');
    await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-12a' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);

    const db = admin.firestore();
    await db.collection('familyMemberships').doc(`${uid}_fam-12a`).update({ status: 'removed' });

    await seedInvite('inv-12b', 'fam-12b');
    const res: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-12b' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);
    expect(res).toEqual({ familyId: 'fam-12b', childId: uid });

    const memB = await db.collection('familyMemberships').doc(`${uid}_fam-12b`).get();
    expect(memB.data()).toMatchObject({ status: 'active', familyId: 'fam-12b' });
  });

  it('legacy 家長（doc id ≠ uid、authProviderId 匹配）接受 child 邀請 → ALREADY_PARENT，不遮蔽', async () => {
    const uid = 'legacy-parent-auth-uid-1';
    const db = admin.firestore();
    // legacy 資料：doc id 不等於 auth uid，靠 authProviderId 對回本人
    await db.collection('users').doc('legacy-parent-doc-1').set({
      displayName: '老爸',
      roleType: 'parent',
      authProvider: 'password',
      authProviderId: uid,
      email: 'kid@example.com',
      createdAt: FieldValue.serverTimestamp(),
    });
    await seedInvite('inv-10', 'fam-10');

    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-10' },
        auth: { uid, token: { email: 'kid@example.com' } },
      } as any)
    ).rejects.toThrow(/ALREADY_PARENT/);

    // 不得建立 users/{uid} 遮蔽 legacy parent doc；invite 也不應被消耗
    const shadowDoc = await db.collection('users').doc(uid).get();
    expect(shadowDoc.exists).toBe(false);
    const invDoc = await db.collection('familyInvites').doc('inv-10').get();
    expect(invDoc.data()!.status).toBe('pending');
  });

  it('家長帳號接受 child 邀請 → failed-precondition ALREADY_PARENT，user doc 不被改寫', async () => {
    const uid = 'parent-uid-8';
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      displayName: '家長',
      roleType: 'parent',
      email: 'kid@example.com',
      createdAt: FieldValue.serverTimestamp(),
    });
    await seedInvite('inv-8', 'fam-8');

    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-8' },
        auth: { uid, token: { email: 'kid@example.com' } },
      } as any)
    ).rejects.toThrow(/ALREADY_PARENT/);

    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()).toMatchObject({ displayName: '家長', roleType: 'parent' });

    const invDoc = await db.collection('familyInvites').doc('inv-8').get();
    expect(invDoc.data()!.status).toBe('pending'); // 不應被標 accepted
  });
});
