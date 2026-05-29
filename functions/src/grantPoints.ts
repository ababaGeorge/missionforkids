import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { resolveAuthoritativeChildId, resolveChildWallet } from './lib/resolveChildWallet';
import { isValidPointsValue } from './lib/points';

const db = admin.firestore();

/**
 * 家長直接給點 / 扣點 — Callable Function。
 * 點數透過 server-side 寫入確定性錢包 pointWallets/{familyId}_{childId}。
 * childId 由 server 從 membership 重新解析，不信任 client。
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

  if (!childUserId || !familyId) {
    throw new HttpsError('invalid-argument', 'Missing parameters');
  }
  // amount > 0 給點、amount < 0 扣點。必須是有限整數且不為 0。
  if (!isValidPointsValue(amount) || amount === 0) {
    throw new HttpsError('invalid-argument', 'amount 必須是非零的有限整數');
  }

  // 驗證呼叫者是家長
  const parentMemberDoc = await db
    .collection('familyMemberships')
    .doc(`${uid}_${familyId}`)
    .get();
  if (!parentMemberDoc.exists || parentMemberDoc.data()?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only parents can grant points');
  }

  // 解析權威 childId（server 端，不信任 client）。child 不屬該家庭 → 拋錯。
  let childId: string;
  try {
    childId = await resolveAuthoritativeChildId(db, familyId, childUserId);
  } catch (e) {
    throw new HttpsError('not-found', 'Child is not a member of this family');
  }

  // Atomic transaction: 找或建確定性錢包 + 寫 transaction
  await db.runTransaction(async (tx) => {
    // tx.get 在任何 write 之前
    const wallet = await resolveChildWallet(tx, db, familyId, childId);

    let delta = amount; // 實際變動量（扣點被 clamp 時會小於 |amount|）
    if (!wallet.exists) {
      const initial = Math.max(0, amount); // 新錢包扣點 clamp 到 0
      delta = initial;
      tx.set(wallet.ref, {
        childId,
        userId: childUserId,
        familyId,
        balance: initial,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const next = Math.max(0, wallet.balance + amount); // 餘額不低於 0
      delta = next - wallet.balance;
      tx.update(wallet.ref, {
        balance: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (delta !== 0) {
      const txRef = db.collection('pointTransactions').doc();
      tx.set(txRef, {
        walletId: wallet.ref.id,
        childId,
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
