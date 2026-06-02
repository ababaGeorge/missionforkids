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
