import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore;

/**
 * rewardOrder 被取消或拒絕時退點。
 * 退款以原始扣款 transaction 的 walletId 為帳本權威（不重算 childId），
 * 確保即使 childId 之後變動，退款仍回原扣款錢包。
 * Idempotency: 確定性退款 transaction doc id `reward_refund_{orderId}`。
 */
export const onRewardOrderCancelledOrRejected = onDocumentUpdated(
  'rewardOrders/{orderId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const refundStatuses = ['cancelled', 'rejected'];
    if (refundStatuses.includes(before.status) || !refundStatuses.includes(after.status)) {
      return;
    }
    // 防「領獎又退點」：已交付/已完成的訂單即使被改成 cancelled/rejected 也不退款。
    // 合法取消只發生在 pending/approved 階段（rules 已限制小孩只能在 pending 取消）。
    if (before.status === 'delivered' || before.status === 'completed') {
      logger.warn('Order already fulfilled, skipping refund', { orderId: event.data!.after.id, beforeStatus: before.status });
      return;
    }

    const orderId = event.data!.after.id;

    // R2-30：交易回傳「是否真的退款」，skip 分支不再印 refunded（避免 log 說謊）。
    // log 留在交易外，交易 retry 時才不會重複印。
    const refunded = await db().runTransaction(async (tx) => {
      // --- reads（全部在 write 之前）---
      // 原始扣款 transaction（確定性 id）→ 帳本權威，提供 walletId
      const deductionRef = db().collection('pointTransactions').doc(`reward_order_${orderId}`);
      const deductionSnap = await tx.get(deductionRef);
      if (!deductionSnap.exists) {
        logger.info('No deduction found, skipping refund', { orderId });
        return false;
      }
      const deduction = deductionSnap.data()!;
      const walletId = deduction.walletId as string;
      const refundAmount = -(deduction.delta as number); // delta 為負，退正值

      // 已退過？
      const refundRef = db().collection('pointTransactions').doc(`reward_refund_${orderId}`);
      const refundSnap = await tx.get(refundRef);
      if (refundSnap.exists) {
        logger.info('Refund already exists, skipping', { orderId });
        return false;
      }

      // 退回原扣款錢包（doc id 直取，不重算 childId）
      const walletRef = db().collection('pointWallets').doc(walletId);
      const walletSnap = await tx.get(walletRef);
      if (!walletSnap.exists) {
        logger.error('Original wallet not found for refund', { orderId, walletId });
        return false;
      }

      // --- writes ---
      tx.update(walletRef, {
        balance: FieldValue.increment(refundAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(refundRef, {
        walletId,
        childId: deduction.childId ?? null,
        delta: refundAmount,
        sourceType: 'reward_refund',
        sourceId: orderId,
        createdBy: null,
        note: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (refunded) {
      logger.info('Reward order refunded', { orderId });
    }
  }
);
