process.env.RESEND_API_KEY = 're_test';

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import functionsTest from 'firebase-functions-test';

// mock 寄信：不打真網路，且可斷言被呼叫
jest.mock('../lib/sendInviteEmail', () => ({
  sendInviteEmail: jest.fn(async () => undefined),
}));
import { sendInviteEmail } from '../lib/sendInviteEmail';
import { createFamilyInvite } from '../createFamilyInvite';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

async function seedParent(uid: string, familyId: string) {
  const db = admin.firestore();
  await db.collection('families').doc(familyId).set({
    displayName: '我們家',
    defaultGraceDays: 2,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection('familyMemberships').doc(`${uid}_${familyId}`).set({
    familyId,
    userId: uid,
    role: 'parent',
    status: 'active',
    invitedBy: uid,
    joinedAt: FieldValue.serverTimestamp(),
  });
}

describe('createFamilyInvite', () => {
  beforeEach(() => jest.clearAllMocks());

  it('家長建 invite doc（pending）並觸發寄信，回傳 inviteId', async () => {
    const uid = 'parent-1';
    const familyId = 'fam-1';
    await seedParent(uid, familyId);

    const res: any = await fft.wrap(createFamilyInvite)({
      data: { familyId, email: 'kid@example.com', childName: '小明', nickname: '阿明' },
      auth: { uid, token: { email: 'mom@example.com' } },
    } as any);

    expect(res.inviteId).toBeTruthy();
    expect(res.emailSent).toBe(true);
    expect(sendInviteEmail).toHaveBeenCalledTimes(1);

    const doc = await admin.firestore().collection('familyInvites').doc(res.inviteId).get();
    expect(doc.data()).toMatchObject({
      email: 'kid@example.com',
      familyId,
      role: 'child',
      status: 'pending',
      invitedBy: uid,
      acceptedBy: null,
    });
    expect(doc.data()?.childProfile).toMatchObject({ displayName: '小明', nickname: '阿明' });
  });

  it('非該家庭家長 → permission-denied', async () => {
    const familyId = 'fam-2';
    await seedParent('real-parent', familyId);
    await expect(
      fft.wrap(createFamilyInvite)({
        data: { familyId, email: 'k@e.com', childName: 'x' },
        auth: { uid: 'stranger', token: {} },
      } as any)
    ).rejects.toThrow(/permission-denied|permission/i);
  });

  it('未登入 → unauthenticated', async () => {
    await expect(
      fft.wrap(createFamilyInvite)({
        data: { familyId: 'f', email: 'k@e.com', childName: 'x' },
      } as any)
    ).rejects.toThrow(/unauthenticated/i);
  });

  it('寄信失敗不擋 invite 建立（emailSent=false，doc 仍存在）', async () => {
    (sendInviteEmail as jest.Mock).mockRejectedValueOnce(new Error('resend down'));
    const uid = 'parent-3';
    const familyId = 'fam-3';
    await seedParent(uid, familyId);

    const res: any = await fft.wrap(createFamilyInvite)({
      data: { familyId, email: 'kid@example.com', childName: '小華' },
      auth: { uid, token: {} },
    } as any);

    expect(res.emailSent).toBe(false);
    const doc = await admin.firestore().collection('familyInvites').doc(res.inviteId).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.status).toBe('pending');
  });
});
