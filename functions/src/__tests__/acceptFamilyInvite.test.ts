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
