import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore;

/**
 * 當孩子建立 rewardOrder 時，從 wallet 扣除點數。
 * 餘額不足則自動 reject 訂單。
 */
export const onRewardOrderCreated = onDocumentCreated(
  'rewardOrders/{orderId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const order = snap.data();
    const { userId, familyId, pointCostSnapshot } = order;
    const orderId = snap.id;

    await db().runTransaction(async (tx) => {
      // 查詢 wallet
      const walletQuery = await tx.get(
        db()
          .collection('pointWallets')
          .where('userId', '==', userId)
          .where('familyId', '==', familyId)
          .limit(1)
      );

      if (walletQuery.empty) {
        tx.update(snap.ref, { status: 'rejected' });
        logger.warn('No wallet found, rejecting order', { orderId });
        return;
      }

      const walletDoc = walletQuery.docs[0];
      const balance = walletDoc.data().balance as number;

      if (balance < pointCostSnapshot) {
        tx.update(snap.ref, { status: 'rejected' });
        logger.warn('Insufficient balance, rejecting order', {
          orderId,
          balance,
          cost: pointCostSnapshot,
        });
        return;
      }

      // 扣點
      tx.update(walletDoc.ref, {
        balance: admin.firestore.FieldValue.increment(-pointCostSnapshot),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 寫入 PointTransaction
      const ptRef = db().collection('pointTransactions').doc();
      tx.set(ptRef, {
        walletId: walletDoc.id,
        delta: -pointCostSnapshot,
        sourceType: 'reward_order',
        sourceId: orderId,
        createdBy: null,
        note: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info('Reward order processed', {
      orderId,
      userId,
      cost: pointCostSnapshot,
    });
  }
);
