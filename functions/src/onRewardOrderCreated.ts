import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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
    const { userId, familyId, itemId } = order;
    const orderId = snap.id;

    // A2 修復：扣點金額只信任 rewardItems 的權威售價，不信任 client 寫的 pointCostSnapshot。
    // 同時驗證品項屬於同家庭且為 active，擋掉「1 點換貴重獎勵」與跨家庭/已封存品項兌換。
    let authoritativeCost: number;
    try {
      const itemSnap = await db().collection('rewardItems').doc(String(itemId)).get();
      if (!itemSnap.exists) throw new Error('reward item not found');
      const item = itemSnap.data()!;
      if (item.familyId !== familyId) throw new Error('reward item family mismatch');
      if (item.status !== 'active') throw new Error('reward item not active');
      authoritativeCost = item.pointCost;
    } catch (e) {
      await snap.ref.update({ status: 'rejected' });
      logger.warn('reward item invalid, rejecting order', { orderId, itemId, err: String(e) });
      return;
    }

    if (!isValidPointsValue(authoritativeCost) || authoritativeCost <= 0) {
      await snap.ref.update({ status: 'rejected' });
      logger.warn('authoritative cost malformed, rejecting order', { orderId, authoritativeCost });
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
      if (wallet.balance < authoritativeCost) {
        tx.update(snap.ref, { status: 'rejected' });
        logger.warn('Insufficient balance, rejecting order', { orderId, balance: wallet.balance, cost: authoritativeCost });
        return;
      }

      tx.update(wallet.ref, {
        balance: FieldValue.increment(-authoritativeCost),
        updatedAt: FieldValue.serverTimestamp(),
      });
      // 把 client 寫的 pointCostSnapshot 正規化成權威售價（顯示與退款一致）
      // BUG-06 修復：把下單當時的扣款前/後餘額寫回訂單 doc，審核 sheet 不用再回推「目前餘額＋cost」
      // （下單到審核之間小孩若又賺了點，回推會失真）。同一 transaction 內寫，語意跟扣款原子綁定。
      tx.update(snap.ref, {
        pointCostSnapshot: authoritativeCost,
        balanceBeforeSnapshot: wallet.balance,
        balanceAfterSnapshot: wallet.balance - authoritativeCost,
      });
      tx.set(ptRef, {
        walletId: wallet.ref.id,
        childId,
        delta: -authoritativeCost,
        sourceType: 'reward_order',
        sourceId: orderId,
        createdBy: null,
        note: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    logger.info('Reward order processed', { orderId, childId, cost: authoritativeCost });
  }
);
