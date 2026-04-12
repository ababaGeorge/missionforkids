import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore;

/**
 * 每小時檢查已交付超過 72 小時的訂單，自動完成。
 */
export const autoCompleteDeliveredOrders = onSchedule(
  'every 1 hours',
  async () => {
    const now = admin.firestore.Timestamp.now();

    const expiredOrders = await db()
      .collection('rewardOrders')
      .where('status', '==', 'delivered')
      .where('autoCompleteAt', '<=', now)
      .get();

    if (expiredOrders.empty) {
      logger.info('No orders to auto-complete');
      return;
    }

    const batch = db().batch();
    let count = 0;

    expiredOrders.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
    });

    await batch.commit();

    logger.info('Auto-completed delivered orders', { count });
  }
);
