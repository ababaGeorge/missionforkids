import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const bootstrapParentAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'unauthenticated: 必須先登入');
  const displayName = String(request.data?.displayName ?? '').trim();
  const familyName = String(request.data?.familyName ?? '').trim();
  if (!displayName || !familyName) throw new HttpsError('invalid-argument', 'displayName 與 familyName 必填');
  const email = (request.auth?.token?.email as string | undefined) ?? null;
  const db = admin.firestore();
  const now = FieldValue.serverTimestamp();
  return db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await tx.get(userRef);
    if (userSnap.exists && userSnap.data()?.roleType === 'parent') {
      const existing = await db.collection('familyMemberships')
        .where('userId', '==', uid).where('role', '==', 'parent').where('status', '==', 'active').limit(1).get();
      if (!existing.empty) return { familyId: existing.docs[0].data().familyId as string };
    }
    // 既有小孩帳號不可自助升級成家長：孤兒恢復路徑（ensureAuthUser）讓小孩用自己的
    // email/密碼從註冊畫面打到這裡，下方 tx.set 無 merge 會整份覆寫 user doc（洗掉
    // childId、roleType 翻成 parent）並另建新家庭。鏡像 acceptFamilyInvite 的 ALREADY_PARENT 守衛。
    if (userSnap.exists && userSnap.data()?.roleType === 'child') {
      throw new HttpsError('failed-precondition', 'ALREADY_CHILD');
    }
    const familyRef = db.collection('families').doc();
    tx.set(userRef, { displayName, avatarUrl: null, authProvider: 'password', authProviderId: uid, roleType: 'parent', email, birthday: null, createdAt: now });
    tx.set(familyRef, { displayName: familyName, defaultGraceDays: 2, createdBy: uid, createdAt: now });
    tx.set(db.collection('familyMemberships').doc(`${uid}_${familyRef.id}`), { familyId: familyRef.id, userId: uid, role: 'parent', status: 'active', invitedBy: uid, joinedAt: now });
    return { familyId: familyRef.id };
  });
});
