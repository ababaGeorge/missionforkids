import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore;

/**
 * 當 taskInstance 狀態變為 approved 時，發放點數到孩子的 wallet。
 * 使用 Firestore transaction 保證原子性。
 * Idempotency: 如果 pointsAwarded 已經有值，跳過（防止重複發點）。
 */
export const onTaskInstanceApproved = onDocumentUpdated(
  'taskInstances/{instanceId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // 只處理狀態變為 approved 的情況
    if (before.status === 'approved' || after.status !== 'approved') {
      return;
    }

    // Idempotency: 已經發過點數就跳過
    if (after.pointsAwarded != null) {
      logger.info('Points already awarded, skipping', {
        instanceId: event.data?.after.id,
      });
      return;
    }

    const instanceId = event.data!.after.id;
    const instanceRef = event.data!.after.ref;
    const { taskId, userId, familyId } = after;

    // 查詢 Task 取得點數
    const taskDoc = await db().collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      logger.error('Task not found', { taskId });
      return;
    }
    const points = taskDoc.data()!.points as number;

    await db().runTransaction(async (tx) => {
      // 找或建 PointWallet
      const walletQuery = await tx.get(
        db()
          .collection('pointWallets')
          .where('userId', '==', userId)
          .where('familyId', '==', familyId)
          .limit(1)
      );

      let walletRef: admin.firestore.DocumentReference;

      if (walletQuery.empty) {
        walletRef = db().collection('pointWallets').doc();
        tx.set(walletRef, {
          userId,
          familyId,
          balance: points,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        walletRef = walletQuery.docs[0].ref;
        tx.update(walletRef, {
          balance: admin.firestore.FieldValue.increment(points),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // 寫入 PointTransaction
      const ptRef = db().collection('pointTransactions').doc();
      tx.set(ptRef, {
        walletId: walletRef.id,
        delta: points,
        sourceType: 'task_completion',
        sourceId: instanceId,
        createdBy: null,
        note: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 標記 pointsAwarded（idempotency 標記）
      tx.update(instanceRef, {
        pointsAwarded: points,
      });
    });

    logger.info('Points awarded', { instanceId, userId, points });
  }
);
