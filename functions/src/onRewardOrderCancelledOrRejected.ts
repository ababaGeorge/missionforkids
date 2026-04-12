import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore;

/**
 * 當 rewardOrder 被取消或拒絕時，退還點數到 wallet。
 * Guard: 只在有對應扣點記錄時才退點（防止重複退點）。
 */
export const onRewardOrderCancelledOrRejected = onDocumentUpdated(
  'rewardOrders/{orderId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // 只處理狀態變為 cancelled 或 rejected 的情況
    const refundStatuses = ['cancelled', 'rejected'];
    if (
      refundStatuses.includes(before.status) ||
      !refundStatuses.includes(after.status)
    ) {
      return;
    }

    const orderId = event.data!.after.id;
    const { userId, familyId, pointCostSnapshot } = after;

    await db().runTransaction(async (tx) => {
      // 檢查是否有對應的扣點記錄（防止重複退點）
      const deductionQuery = await tx.get(
        db()
          .collection('pointTransactions')
          .where('sourceId', '==', orderId)
          .where('sourceType', '==', 'reward_order')
          .limit(1)
      );

      if (deductionQuery.empty) {
        logger.info('No deduction found, skipping refund', { orderId });
        return;
      }

      // 檢查是否已經退過
      const refundQuery = await tx.get(
        db()
          .collection('pointTransactions')
          .where('sourceId', '==', orderId)
          .where('sourceType', '==', 'reward_refund')
          .limit(1)
      );

      if (!refundQuery.empty) {
        logger.info('Refund already exists, skipping', { orderId });
        return;
      }

      // 查詢 wallet
      const walletQuery = await tx.get(
        db()
          .collection('pointWallets')
          .where('userId', '==', userId)
          .where('familyId', '==', familyId)
          .limit(1)
      );

      if (walletQuery.empty) {
        logger.error('Wallet not found for refund', { orderId, userId });
        return;
      }

      const walletDoc = walletQuery.docs[0];

      // 退點
      tx.update(walletDoc.ref, {
        balance: admin.firestore.FieldValue.increment(pointCostSnapshot),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 寫入退點 PointTransaction
      const ptRef = db().collection('pointTransactions').doc();
      tx.set(ptRef, {
        walletId: walletDoc.id,
        delta: pointCostSnapshot,
        sourceType: 'reward_refund',
        sourceId: orderId,
        createdBy: null,
        note: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info('Reward order refunded', {
      orderId,
      userId,
      amount: pointCostSnapshot,
    });
  }
);
