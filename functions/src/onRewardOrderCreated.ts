import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { resolveAuthoritativeChildId, resolveChildWallet } from './lib/resolveChildWallet';
import { isValidPointsValue } from './lib/points';

const db = admin.firestore;

/**
 * 孩子建立 rewardOrder 時，從確定性錢包 {familyId}_{childId} 扣點。
 * childId 由 server 從 membership 重新解析（不信任 doc 上 client 寫的 childId）。
 * Idempotency: 確定性扣款 transaction doc id `reward_order_{orderId}`。
 * 餘額不足 / 錢包不存在 / 金額異常 → reject 訂單。
 */
export const onRewardOrderCreated = onDocumentCreated(
  'rewardOrders/{orderId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const order = snap.data();
    const { userId, familyId, pointCostSnapshot } = order;
    const orderId = snap.id;

    if (!isValidPointsValue(pointCostSnapshot) || pointCostSnapshot <= 0) {
      await snap.ref.update({ status: 'rejected' });
      logger.warn('pointCostSnapshot malformed, rejecting order', { orderId, pointCostSnapshot });
      return;
    }

    let childId: string;
    try {
      childId = await resolveAuthoritativeChildId(db(), familyId, userId);
    } catch (e) {
      await snap.ref.update({ status: 'rejected' });
      logger.error('resolveAuthoritativeChildId failed, rejecting order', { orderId, err: String(e) });
      return;
    }

    await db().runTransaction(async (tx) => {
      // --- reads ---
      const ptRef = db().collection('pointTransactions').doc(`reward_order_${orderId}`);
      const ptSnap = await tx.get(ptRef);
      if (ptSnap.exists) return; // 已扣過（重放保護）

      const wallet = await resolveChildWallet(tx, db(), familyId, childId);

      // --- writes ---
      if (!wallet.exists) {
        tx.update(snap.ref, { status: 'rejected' });
        logger.warn('No wallet found, rejecting order', { orderId });
        return;
      }
      if (wallet.balance < pointCostSnapshot) {
        tx.update(snap.ref, { status: 'rejected' });
        logger.warn('Insufficient balance, rejecting order', { orderId, balance: wallet.balance, cost: pointCostSnapshot });
        return;
      }

      tx.update(wallet.ref, {
        balance: admin.firestore.FieldValue.increment(-pointCostSnapshot),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.set(ptRef, {
        walletId: wallet.ref.id,
        childId,
        delta: -pointCostSnapshot,
        sourceType: 'reward_order',
        sourceId: orderId,
        createdBy: null,
        note: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info('Reward order processed', { orderId, childId, cost: pointCostSnapshot });
  }
);
