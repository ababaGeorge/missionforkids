import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { bootstrapParentAccount } from '../bootstrapParentAccount';

const fft = functionsTest({ projectId: 'mission-for-kids' });
function wrap() { return fft.wrap(bootstrapParentAccount); }
afterAll(() => fft.cleanup());

describe('bootstrapParentAccount', () => {
  it('建立 parent user doc + family + 家長 membership 並回傳 familyId', async () => {
    const uid = 'parent-uid-1';
    const res: any = await wrap()({
      data: { displayName: '媽媽', familyName: '我們家' },
      auth: { uid, token: { email: 'mom@example.com' } },
    } as any);
    expect(res.familyId).toBeTruthy();
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()).toMatchObject({ roleType: 'parent', displayName: '媽媽', email: 'mom@example.com', authProvider: 'password' });
    const famDoc = await db.collection('families').doc(res.familyId).get();
    expect(famDoc.data()).toMatchObject({ displayName: '我們家', createdBy: uid });
    const memDoc = await db.collection('familyMemberships').doc(`${uid}_${res.familyId}`).get();
    expect(memDoc.data()).toMatchObject({ userId: uid, role: 'parent', status: 'active', familyId: res.familyId });
  });

  it('未登入時丟 unauthenticated', async () => {
    await expect(wrap()({ data: { displayName: 'x', familyName: 'y' } } as any)).rejects.toThrow(/unauthenticated/i);
  });

  it('既有小孩帳號 → 拋 ALREADY_CHILD，user doc 不被覆寫、不另建 family', async () => {
    const uid = 'child-uid-1';
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      displayName: '小安', roleType: 'child', childId: uid,
      authProvider: 'password', authProviderId: uid, email: 'kid@example.com',
    });
    await expect(
      wrap()({ data: { displayName: '小安', familyName: '偷渡家庭' }, auth: { uid, token: { email: 'kid@example.com' } } } as any)
    ).rejects.toThrow(/ALREADY_CHILD/);
    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()).toMatchObject({ roleType: 'child', childId: uid, displayName: '小安' });
    const fams = await db.collection('families').where('createdBy', '==', uid).get();
    expect(fams.size).toBe(0);
  });

  it('legacy 小孩（doc id ≠ uid、authProviderId 匹配）→ 拋 ALREADY_CHILD、不遮蔽不建 family', async () => {
    const uid = 'legacy-child-auth-uid-1';
    const db = admin.firestore();
    // legacy 資料：doc id 是 placeholder，不等於 auth uid，靠 authProviderId 對回本人
    await db.collection('users').doc('legacy-child-doc-1').set({
      displayName: '小樂', roleType: 'child', childId: 'legacy-child-doc-1',
      authProvider: 'password', authProviderId: uid, email: 'legacykid@example.com',
    });
    await expect(
      wrap()({ data: { displayName: '小樂', familyName: '偷渡家庭' }, auth: { uid, token: { email: 'legacykid@example.com' } } } as any)
    ).rejects.toThrow(/ALREADY_CHILD/);
    // 不得建立 users/{uid} 遮蔽 legacy child doc
    const shadowDoc = await db.collection('users').doc(uid).get();
    expect(shadowDoc.exists).toBe(false);
    const fams = await db.collection('families').where('createdBy', '==', uid).get();
    expect(fams.size).toBe(0);
  });

  it('冪等：同一個 parent 再呼叫不會建第二個 family', async () => {
    const uid = 'parent-uid-2';
    const first: any = await wrap()({ data: { displayName: '爸爸', familyName: '家一' }, auth: { uid, token: { email: 'dad@example.com' } } } as any);
    const second: any = await wrap()({ data: { displayName: '爸爸', familyName: '家二' }, auth: { uid, token: { email: 'dad@example.com' } } } as any);
    expect(second.familyId).toBe(first.familyId);
    const db = admin.firestore();
    const fams = await db.collection('families').where('createdBy', '==', uid).get();
    expect(fams.size).toBe(1);
  });
});
