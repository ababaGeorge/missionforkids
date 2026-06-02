import * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;
type Transaction = admin.firestore.Transaction;
type DocumentReference = admin.firestore.DocumentReference;

/**
 * 解析權威 childId（family-scoped）。
 *
 * 點數金流一律用這個在 server 端重新解析，**不信任 client 寫進 doc 的 childId 欄位**。
 * - 讀 `familyMemberships/{userId}_{familyId}`
 * - 回傳 `membership.childId ?? userId`
 * - 唯一容許的 fallback：membership 存在但**沒有 childId 欄位**（舊帳號）→ 用 userId
 * - membership 不存在 / familyId 不符 / childId 是空字串或非字串 → **拋錯**（不靜默 fallback）
 *
 * 這是純讀取，呼叫端應在 runTransaction **之前**呼叫（membership 不參與錢包寫入的原子性）。
 */
export async function resolveAuthoritativeChildId(
  db: Firestore,
  familyId: string,
  userId: string
): Promise<string> {
  if (!familyId || !userId) {
    throw new Error('resolveAuthoritativeChildId: familyId 與 userId 必填');
  }
  const memSnap = await db
    .collection('familyMemberships')
    .doc(`${userId}_${familyId}`)
    .get();
  if (!memSnap.exists) {
    throw new Error(`membership 不存在: ${userId}_${familyId}`);
  }
  const data = memSnap.data()!;
  if (data.familyId !== familyId) {
    throw new Error(
      `membership familyId 不符: 期望 ${familyId}, 實際 ${String(data.familyId)}`
    );
  }
  const childId = data.childId;
  // 舊帳號沒有 childId 欄位 → 唯一容許的 fallback。
  if (childId === undefined || childId === null) {
    return userId;
  }
  if (typeof childId !== 'string' || childId.trim() === '') {
    throw new Error(`childId malformed: ${JSON.stringify(childId)}`);
  }
  return childId;
}

/**
 * 定位確定性錢包 `pointWallets/{familyId}_{childId}` 並在 transaction 內讀現值。
 *
 * - 只「組」doc id，從不反向解析（避免分隔符歧義）。
 * - 寫入留給呼叫端決定（給點 / 扣點 / 退款語意不同）。
 * - `tx.get` 必須在呼叫端任何 `tx.write` 之前執行。
 */
export async function resolveChildWallet(
  tx: Transaction,
  db: Firestore,
  familyId: string,
  childId: string
): Promise<{ ref: DocumentReference; exists: boolean; balance: number }> {
  const ref = db.collection('pointWallets').doc(`${familyId}_${childId}`);
  const snap = await tx.get(ref);
  const balance = (snap.exists ? (snap.data()?.balance as number) : 0) ?? 0;
  return { ref, exists: snap.exists, balance };
}
