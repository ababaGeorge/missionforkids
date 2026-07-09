import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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

  const { childUserId, familyId, amount, reason, idempotencyKey } = request.data as {
    childUserId: string;
    familyId: string;
    amount: number;
    reason: string;
    idempotencyKey?: string;
  };

  if (!childUserId || !familyId) {
    throw new HttpsError('invalid-argument', 'Missing parameters');
  }
  // amount > 0 給點、amount < 0 扣點。必須是有限整數且不為 0。
  if (!isValidPointsValue(amount) || amount === 0) {
    throw new HttpsError('invalid-argument', 'amount 必須是非零的有限整數');
  }

  // 驗證呼叫者是「active」家長。被移除的家長 membership 仍在、role 仍是 'parent'，
  // 必須連 status==='active' 一起驗，否則被踢出家庭的家長還能給/扣點。
  const parentMemberDoc = await db
    .collection('familyMemberships')
    .doc(`${uid}_${familyId}`)
    .get();
  const parentData = parentMemberDoc.data();
  if (!parentMemberDoc.exists || parentData?.role !== 'parent' || parentData?.status !== 'active') {
    throw new HttpsError('permission-denied', 'Only active parents can grant points');
  }

  // 驗證收點對象是該家庭的 active 小孩：
  // - 擋發點給「被移除的小孩」（status==='removed'）
  // - 擋把非 child 成員（如另一位家長）指定為收點對象
  // 註：這裡多讀一次 membership（resolveAuthoritativeChildId 只回 childId、不回 status/role，
  //     且它是 onRewardOrderCreated / onTaskInstanceApproved 共用，不宜為此加 status 檢查而
  //     波及其他路徑），故在本地端顯式驗證。
  const childMemberDoc = await db
    .collection('familyMemberships')
    .doc(`${childUserId}_${familyId}`)
    .get();
  const childData = childMemberDoc.data();
  if (!childMemberDoc.exists || childData?.role !== 'child' || childData?.status !== 'active') {
    throw new HttpsError('not-found', 'Child is not an active member of this family');
  }

  // 解析權威 childId（server 端，不信任 client）。child 不屬該家庭 → 拋錯。
  let childId: string;
  try {
    childId = await resolveAuthoritativeChildId(db, familyId, childUserId);
  } catch (e) {
    throw new HttpsError('not-found', 'Child is not a member of this family');
  }

  // Atomic transaction: 找或建確定性錢包 + 寫 transaction。
  // 回傳實際變動量 delta（扣點被 clamp 時 |delta| < |amount|），供 client 顯示真實扣除值；
  // 冪等重放（已處理過）拿不到當次 delta → 回 null，client 端 fallback 用請求值。
  const delta = await db.runTransaction<number | null>(async (tx) => {
    // A9 冪等：有 idempotencyKey 時用確定性 tx doc id，重送/連點同一 key 不重複發點。
    const txRef = idempotencyKey
      ? db.collection('pointTransactions').doc(`parent_grant_${idempotencyKey}`)
      : db.collection('pointTransactions').doc();
    if (idempotencyKey) {
      const existing = await tx.get(txRef); // 讀必須在任何 write 之前
      if (existing.exists) return null; // 已處理過，直接結束
    }

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
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const next = Math.max(0, wallet.balance + amount); // 餘額不低於 0
      delta = next - wallet.balance;
      tx.update(wallet.ref, {
        balance: next,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (delta !== 0) {
      tx.set(txRef, {
        walletId: wallet.ref.id,
        childId,
        delta,
        sourceType: 'parent_grant',
        sourceId: null,
        createdBy: uid,
        note: reason || (amount < 0 ? 'Parent deduct' : 'Parent grant'),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return delta;
  });

  return { success: true, delta };
});
