import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 家長直接給點 — Callable Function
 * 確保 pointWallets 的寫入透過 server-side 完成
 */
export const grantPoints = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const { childUserId, familyId, amount, reason } = request.data as {
    childUserId: string;
    familyId: string;
    amount: number;
    reason: string;
  };

  if (!childUserId || !familyId || !amount || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid parameters');
  }

  // 驗證呼叫者是家長
  const parentMemberDoc = await db
    .collection('familyMemberships')
    .doc(`${uid}_${familyId}`)
    .get();

  if (!parentMemberDoc.exists || parentMemberDoc.data()?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only parents can grant points');
  }

  // 驗證孩子是同一個家庭的成員
  const childMemberDoc = await db
    .collection('familyMemberships')
    .doc(`${childUserId}_${familyId}`)
    .get();

  if (!childMemberDoc.exists) {
    throw new HttpsError('not-found', 'Child is not a member of this family');
  }

  // Atomic transaction: 建立或更新 wallet + 建立 transaction
  await db.runTransaction(async (tx) => {
    const walletQuery = await db
      .collection('pointWallets')
      .where('userId', '==', childUserId)
      .where('familyId', '==', familyId)
      .limit(1)
      .get();

    let walletRef: admin.firestore.DocumentReference;

    if (walletQuery.empty) {
      walletRef = db.collection('pointWallets').doc();
      tx.set(walletRef, {
        userId: childUserId,
        familyId,
        balance: amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      walletRef = walletQuery.docs[0].ref;
      tx.update(walletRef, {
        balance: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const txRef = db.collection('pointTransactions').doc();
    tx.set(txRef, {
      walletId: walletRef.id,
      delta: amount,
      sourceType: 'parent_grant',
      sourceId: null,
      createdBy: uid,
      note: reason || 'Parent grant',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});
