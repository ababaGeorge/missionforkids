import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import functionsTest from 'firebase-functions-test';
import { removeFamilyMember } from '../removeFamilyMember';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

const db = () => admin.firestore();

async function seedMembership(
  userId: string,
  familyId: string,
  overrides: Record<string, any> = {}
) {
  await db().collection('familyMemberships').doc(`${userId}_${familyId}`).set({
    familyId,
    userId,
    role: 'child',
    status: 'active',
    invitedBy: 'parent-1',
    joinedAt: FieldValue.serverTimestamp(),
    nickname: '阿明',
    avatarEmoji: '🦊',
    childId: userId,
    ...overrides,
  });
}

async function seedUser(userId: string, overrides: Record<string, any> = {}) {
  await db().collection('users').doc(userId).set({
    displayName: '小明',
    roleType: 'child',
    authProvider: 'password',
    authProviderId: userId,
    email: 'kid@example.com',
    createdAt: FieldValue.serverTimestamp(),
    ...overrides,
  });
}

async function seedInvite(
  inviteId: string,
  familyId: string,
  overrides: Record<string, any> = {}
) {
  await db().collection('familyInvites').doc(inviteId).set({
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

function call(data: any, uid?: string) {
  return fft.wrap(removeFamilyMember)({
    data,
    ...(uid ? { auth: { uid, token: {} } } : {}),
  } as any);
}

describe('removeFamilyMember', () => {
  it('家長移除 active 小孩 → membership 標 removed（joinedAt/暱稱保留）＋同家庭 pending 邀請全 revoked', async () => {
    const familyId = 'fam-r1';
    await seedMembership('parent-1', familyId, { role: 'parent', nickname: null });
    await seedMembership('kid-1', familyId);
    // email 大小寫混寫：CF 應 lowercase 後匹配（invite.email 建立時已 lowercase）
    await seedUser('kid-1', { email: 'Kid@Example.com' });
    // 同家庭同 email 兩張 pending → 都要 revoked
    await seedInvite('inv-r1a', familyId);
    await seedInvite('inv-r1b', familyId);
    // 同家庭已 accepted → 不動；別家庭 pending → 不動；同家庭別人的 pending → 不動
    await seedInvite('inv-r1c', familyId, { status: 'accepted', acceptedBy: 'kid-1' });
    await seedInvite('inv-r1d', 'fam-other');
    await seedInvite('inv-r1e', familyId, { email: 'other-kid@example.com' });

    const res: any = await call({ familyId, memberUserId: 'kid-1' }, 'parent-1');
    expect(res).toEqual({ removed: true, revokedInvites: 2 });

    const mem = await db().collection('familyMemberships').doc(`kid-1_${familyId}`).get();
    expect(mem.data()).toMatchObject({
      status: 'removed',
      removedBy: 'parent-1',
      nickname: '阿明',
      childId: 'kid-1',
    });
    expect(mem.data()!.removedAt).toBeTruthy();
    expect(mem.data()!.joinedAt).toBeTruthy(); // 欄位保留

    for (const [id, status] of [
      ['inv-r1a', 'revoked'],
      ['inv-r1b', 'revoked'],
      ['inv-r1c', 'accepted'],
      ['inv-r1d', 'pending'],
      ['inv-r1e', 'pending'],
    ]) {
      const inv = await db().collection('familyInvites').doc(id).get();
      expect({ id, status: inv.data()!.status }).toEqual({ id, status });
    }
    const revoked = await db().collection('familyInvites').doc('inv-r1a').get();
    expect(revoked.data()).toMatchObject({ status: 'revoked', revokedBy: 'parent-1' });
    expect(revoked.data()!.revokedAt).toBeTruthy();
  });

  it('未登入 → unauthenticated', async () => {
    await expect(call({ familyId: 'f', memberUserId: 'k' })).rejects.toThrow(/unauthenticated/i);
  });

  it('缺參數 → invalid-argument', async () => {
    await expect(call({ familyId: 'f' }, 'parent-1')).rejects.toThrow(/必填/);
  });

  it('caller 無 membership → NOT_PARENT', async () => {
    const familyId = 'fam-r2';
    await seedMembership('kid-1', familyId);
    await expect(call({ familyId, memberUserId: 'kid-1' }, 'stranger')).rejects.toThrow(
      /NOT_PARENT/
    );
  });

  it('caller 是小孩 → NOT_PARENT', async () => {
    const familyId = 'fam-r3';
    await seedMembership('kid-1', familyId);
    await seedMembership('kid-2', familyId);
    await expect(call({ familyId, memberUserId: 'kid-2' }, 'kid-1')).rejects.toThrow(
      /NOT_PARENT/
    );
  });

  it('caller 是 parent 但已被移除（非 active）→ NOT_PARENT', async () => {
    const familyId = 'fam-r4';
    await seedMembership('parent-1', familyId, { role: 'parent', status: 'removed' });
    await seedMembership('kid-1', familyId);
    await expect(call({ familyId, memberUserId: 'kid-1' }, 'parent-1')).rejects.toThrow(
      /NOT_PARENT/
    );
  });

  it('目標 membership 不存在 → MEMBER_NOT_FOUND', async () => {
    const familyId = 'fam-r5';
    await seedMembership('parent-1', familyId, { role: 'parent' });
    await expect(call({ familyId, memberUserId: 'ghost' }, 'parent-1')).rejects.toThrow(
      /MEMBER_NOT_FOUND/
    );
  });

  it('目標已被移除（非 active）→ MEMBER_NOT_FOUND', async () => {
    const familyId = 'fam-r6';
    await seedMembership('parent-1', familyId, { role: 'parent' });
    await seedMembership('kid-1', familyId, { status: 'removed' });
    await expect(call({ familyId, memberUserId: 'kid-1' }, 'parent-1')).rejects.toThrow(
      /MEMBER_NOT_FOUND/
    );
  });

  it('家長移除自己 → CANNOT_REMOVE_SELF（優先於 ONLY_CHILD_REMOVABLE）', async () => {
    const familyId = 'fam-r7';
    await seedMembership('parent-1', familyId, { role: 'parent' });
    await expect(call({ familyId, memberUserId: 'parent-1' }, 'parent-1')).rejects.toThrow(
      /CANNOT_REMOVE_SELF/
    );
    const mem = await db().collection('familyMemberships').doc(`parent-1_${familyId}`).get();
    expect(mem.data()!.status).toBe('active'); // 交易回滾，不留半套
  });

  it('目標是另一位家長 → ONLY_CHILD_REMOVABLE，membership 不動', async () => {
    const familyId = 'fam-r8';
    await seedMembership('parent-1', familyId, { role: 'parent' });
    await seedMembership('parent-2', familyId, { role: 'parent' });
    await expect(call({ familyId, memberUserId: 'parent-2' }, 'parent-1')).rejects.toThrow(
      /ONLY_CHILD_REMOVABLE/
    );
    const mem = await db().collection('familyMemberships').doc(`parent-2_${familyId}`).get();
    expect(mem.data()!.status).toBe('active');
  });

  it('user doc 無 email（legacy）→ 移除成功、跳過作廢、warning NO_EMAIL_SKIP_REVOKE', async () => {
    const familyId = 'fam-r9';
    await seedMembership('parent-1', familyId, { role: 'parent' });
    await seedMembership('kid-1', familyId);
    await seedUser('kid-1', { email: null });
    await seedInvite('inv-r9', familyId); // 就算存在 pending 邀請也不作廢（無 email 無法安全匹配）

    const res: any = await call({ familyId, memberUserId: 'kid-1' }, 'parent-1');
    expect(res).toEqual({ removed: true, revokedInvites: 0, warning: 'NO_EMAIL_SKIP_REVOKE' });

    const mem = await db().collection('familyMemberships').doc(`kid-1_${familyId}`).get();
    expect(mem.data()!.status).toBe('removed');
    const inv = await db().collection('familyInvites').doc('inv-r9').get();
    expect(inv.data()!.status).toBe('pending');
  });

  it('user doc 不存在（legacy doc id ≠ uid）→ 同無 email 分支，移除成功＋warning', async () => {
    const familyId = 'fam-r10';
    await seedMembership('parent-1', familyId, { role: 'parent' });
    await seedMembership('kid-1', familyId);
    // 不 seed users/kid-1

    const res: any = await call({ familyId, memberUserId: 'kid-1' }, 'parent-1');
    expect(res).toEqual({ removed: true, revokedInvites: 0, warning: 'NO_EMAIL_SKIP_REVOKE' });
  });

  it('沒有匹配的 pending 邀請 → revokedInvites 0、無 warning', async () => {
    const familyId = 'fam-r11';
    await seedMembership('parent-1', familyId, { role: 'parent' });
    await seedMembership('kid-1', familyId);
    await seedUser('kid-1');

    const res: any = await call({ familyId, memberUserId: 'kid-1' }, 'parent-1');
    expect(res).toEqual({ removed: true, revokedInvites: 0 });
  });
});
