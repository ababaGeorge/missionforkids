import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveAuthoritativeChildId, resolveChildWallet } from './lib/resolveChildWallet';
import { isValidPointsValue } from './lib/points';

const db = admin.firestore;

/**
 * taskInstance 變 approved 時，發點到孩子的確定性錢包 {familyId}_{childId}。
 * childId 由 server 從 membership 重新解析（不信任 doc 上 client 寫的 childId）。
 * Idempotency: transaction 內重讀 instance 的 pointsAwarded + 確定性 transaction doc id。
 */
export const onTaskInstanceApproved = onDocumentUpdated(
  'taskInstances/{instanceId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // 只處理狀態變為 approved
    if (before.status === 'approved' || after.status !== 'approved') return;

    // A1 縱深防禦：核准動作必須由該家庭的 active 家長發出（reviewedBy）。
    // firestore.rules 已擋小孩自批，但若規則日後被放寬，這裡是第二道閘門——
    // 沒有合法家長核准者就不發點。
    const reviewerUid = after.reviewedBy as string | null | undefined;
    if (!reviewerUid) {
      logger.warn('approved without reviewedBy, skipping award', { instanceId: event.data?.after.id });
      return;
    }
    const reviewerMembership = await db()
      .collection('familyMemberships')
      .doc(`${reviewerUid}_${after.familyId}`)
      .get();
    if (
      !reviewerMembership.exists ||
      reviewerMembership.data()?.role !== 'parent' ||
      reviewerMembership.data()?.status !== 'active'
    ) {
      logger.warn('approver is not an active family parent, skipping award', {
        instanceId: event.data?.after.id,
        reviewerUid,
      });
      return;
    }

    // 早退：已發過（事件層級快速判斷；transaction 內會再嚴格重讀）
    if (after.pointsAwarded != null) {
      logger.info('Points already awarded, skipping', { instanceId: event.data?.after.id });
      return;
    }

    const instanceId = event.data!.after.id;
    const instanceRef = event.data!.after.ref;
    const { taskId, userId, familyId } = after;

    const taskDoc = await db().collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) {
      logger.error('Task not found', { taskId });
      return;
    }
    const points = taskDoc.data()!.points as number;
    if (!isValidPointsValue(points)) {
      logger.error('Task points malformed, skipping', { taskId, points });
      return;
    }

    // server 端解析權威 childId（membership 讀取，在 transaction 之前）
    let childId: string;
    try {
      childId = await resolveAuthoritativeChildId(db(), familyId, userId);
    } catch (e) {
      logger.error('resolveAuthoritativeChildId failed, skipping', { instanceId, userId, familyId, err: String(e) });
      return;
    }

    await db().runTransaction(async (tx) => {
      // --- 所有 read 在任何 write 之前 ---
      const instanceSnap = await tx.get(instanceRef);
      if (instanceSnap.data()?.pointsAwarded != null) {
        // 重放保護：別的觸發已發過
        return;
      }
      const wallet = await resolveChildWallet(tx, db(), familyId, childId);
      const ptRef = db().collection('pointTransactions').doc(`task_completion_${instanceId}`);
      const ptSnap = await tx.get(ptRef);
      if (ptSnap.exists) return; // 確定性 tx id 已存在 → 已發過

      // --- writes ---
      if (!wallet.exists) {
        tx.set(wallet.ref, {
          childId,
          userId,
          familyId,
          balance: points,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(wallet.ref, {
          balance: FieldValue.increment(points),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.set(ptRef, {
        walletId: wallet.ref.id,
        childId,
        delta: points,
        sourceType: 'task_completion',
        sourceId: instanceId,
        createdBy: null,
        note: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(instanceRef, { pointsAwarded: points });
    });

    logger.info('Points awarded', { instanceId, childId, points });
  }
);
