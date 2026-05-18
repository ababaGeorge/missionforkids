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

  if (!childUserId || !familyId || !amount || amount === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid parameters');
  }
  // amount > 0 給點、amount < 0 扣點。扣點時餘額不低於 0（transaction 內 clamp）。

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
    // 必須用 tx.get：grantPoints 寫的是 clamp 後的絕對值（非 increment），
    // 讀取沒掛在交易上的話，並發呼叫會 lost update。
    const walletQuery = await tx.get(
      db
        .collection('pointWallets')
        .where('userId', '==', childUserId)
        .where('familyId', '==', familyId)
        .limit(1)
    );

    let walletRef: admin.firestore.DocumentReference;
    let delta = amount; // 實際變動量（扣點被 clamp 時會小於 |amount|）

    if (walletQuery.empty) {
      walletRef = db.collection('pointWallets').doc();
      // 新 wallet：扣點不可為負，clamp 到 0
      const initial = Math.max(0, amount);
      delta = initial;
      tx.set(walletRef, {
        userId: childUserId,
        familyId,
        balance: initial,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      walletRef = walletQuery.docs[0].ref;
      const current = (walletQuery.docs[0].data().balance as number) || 0;
      const next = Math.max(0, current + amount); // 餘額不低於 0
      delta = next - current;
      tx.update(walletRef, {
        balance: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (delta !== 0) {
      const txRef = db.collection('pointTransactions').doc();
      tx.set(txRef, {
        walletId: walletRef.id,
        delta,
        sourceType: 'parent_grant',
        sourceId: null,
        createdBy: uid,
        note: reason || (amount < 0 ? 'Parent deduct' : 'Parent grant'),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { success: true };
});
