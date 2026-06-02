import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const bootstrapParentAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'unauthenticated: 必須先登入');
  const displayName = String(request.data?.displayName ?? '').trim();
  const familyName = String(request.data?.familyName ?? '').trim();
  if (!displayName || !familyName) throw new HttpsError('invalid-argument', 'displayName 與 familyName 必填');
  const email = (request.auth?.token?.email as string | undefined) ?? null;
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  return db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await tx.get(userRef);
    if (userSnap.exists && userSnap.data()?.roleType === 'parent') {
      const existing = await db.collection('familyMemberships')
        .where('userId', '==', uid).where('role', '==', 'parent').where('status', '==', 'active').limit(1).get();
      if (!existing.empty) return { familyId: existing.docs[0].data().familyId as string };
    }
    const familyRef = db.collection('families').doc();
    tx.set(userRef, { displayName, avatarUrl: null, authProvider: 'password', authProviderId: uid, roleType: 'parent', email, birthday: null, createdAt: now });
    tx.set(familyRef, { displayName: familyName, defaultGraceDays: 2, createdBy: uid, createdAt: now });
    tx.set(db.collection('familyMemberships').doc(`${uid}_${familyRef.id}`), { familyId: familyRef.id, userId: uid, role: 'parent', status: 'active', invitedBy: uid, joinedAt: now });
    return { familyId: familyRef.id };
  });
});
