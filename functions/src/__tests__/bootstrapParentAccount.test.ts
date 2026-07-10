import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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

  it('R3-2：已有任一家庭的 active membership → ALREADY_IN_FAMILY，不建 family 不寫 user doc', async () => {
    const uid = 'member-uid-3';
    const db = admin.firestore();
    // 帳號已是某家庭的 active 成員（users doc 缺失的異常資料也要擋——守衛只看 membership）
    await db.collection('familyMemberships').doc(`${uid}_fam-z`).set({
      familyId: 'fam-z', userId: uid, role: 'child', status: 'active',
      invitedBy: 'parent-x', joinedAt: FieldValue.serverTimestamp(),
    });
    await expect(
      wrap()({ data: { displayName: '想開新家', familyName: '第二家庭' }, auth: { uid, token: { email: 'multi@example.com' } } } as any)
    ).rejects.toThrow(/ALREADY_IN_FAMILY/);
    // 交易整體回滾：不建 family、不建 users/{uid}
    const fams = await db.collection('families').where('createdBy', '==', uid).get();
    expect(fams.size).toBe(0);
    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.exists).toBe(false);
  });

  it('R3-2：曾有 membership 但已 removed（非 active）→ 可建立新家庭', async () => {
    const uid = 'member-uid-4';
    const db = admin.firestore();
    await db.collection('familyMemberships').doc(`${uid}_fam-old`).set({
      familyId: 'fam-old', userId: uid, role: 'child', status: 'removed',
      invitedBy: 'parent-x', joinedAt: FieldValue.serverTimestamp(),
    });
    const res: any = await wrap()({
      data: { displayName: '重新開始', familyName: '新家庭' },
      auth: { uid, token: { email: 'fresh@example.com' } },
    } as any);
    expect(res.familyId).toBeTruthy();
    const memDoc = await db.collection('familyMemberships').doc(`${uid}_${res.familyId}`).get();
    expect(memDoc.data()).toMatchObject({ role: 'parent', status: 'active' });
  });

  it('R3 審查修正：user doc 已存在（parent、無 active membership）→ 建家庭但不覆寫 user doc（可不帶 displayName）', async () => {
    const uid = 'existing-parent-uid-1';
    const db = admin.firestore();
    // 情境：家長被移出家庭後，從 family 頁重建家庭（client 已改走本 CF，只帶 familyName）
    await db.collection('users').doc(uid).set({
      displayName: '原本的名字', roleType: 'parent', avatarUrl: 'a.png', birthday: '1990-01-01',
      authProvider: 'password', authProviderId: uid, email: 'keep@example.com',
    });
    const res: any = await wrap()({
      data: { familyName: '重建的家' },
      auth: { uid, token: { email: 'keep@example.com' } },
    } as any);
    expect(res.familyId).toBeTruthy();
    // user doc 原欄位一律保留，不被整份覆寫
    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()).toMatchObject({
      displayName: '原本的名字', avatarUrl: 'a.png', birthday: '1990-01-01', roleType: 'parent',
    });
    const memDoc = await db.collection('familyMemberships').doc(`${uid}_${res.familyId}`).get();
    expect(memDoc.data()).toMatchObject({ userId: uid, role: 'parent', status: 'active' });
  });

  it('R3 審查修正：user doc 不存在且未帶 displayName → invalid-argument，不建 family', async () => {
    const uid = 'no-doc-no-name-uid-1';
    await expect(
      wrap()({ data: { familyName: '沒名字的家' }, auth: { uid, token: { email: 'x@example.com' } } } as any)
    ).rejects.toThrow(/displayName/);
    const db = admin.firestore();
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
