import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * 兌換邀請碼 — Callable Function
 *
 * 改為 server-side：client 端被 firestore rule
 * `users update: request.auth.uid == userId` 擋住，無法把自己的 authUid
 * 寫進家長建的 placeholder child user doc。這裡用 admin 權限繞過 client
 * rules，並在 transaction 內保證原子性。
 *
 * - 孩子碼：authUid 寫入 child user doc 的 authProviderId
 *           + 建 ${authUid}_${familyId} membership
 *           + placeholder membership 標記 removed
 * - 家長碼：建 ${authUid}_${familyId} parent membership
 * - 碼標記為 used
 *
 * 重綁遷移：dev 流程每次進場都換新匿名 uid，舊 uid 的 wallet/instances
 * 會成孤兒（小孩看不到先前點數/進度）。若 child user doc 原本已綁過
 * 別的 uid（prevUid），bind 後把 prevUid 的 pointWallet + taskInstances
 * 在同 family 內遷移到新 uid。prod 只在「重複兌換」時觸發（罕見且行為
 * 正確：孩子重新被邀請仍保有點數）。
 */
async function migrateChildData(
  oldUid: string,
  newUid: string,
  familyId: string
): Promise<{ wallets: number; instances: number }> {
  const batch = db.batch();

  const [walletQ, newWalletQ, instQ] = await Promise.all([
    db
      .collection('pointWallets')
      .where('userId', '==', oldUid)
      .where('familyId', '==', familyId)
      .get(),
    db
      .collection('pointWallets')
      .where('userId', '==', newUid)
      .where('familyId', '==', familyId)
      .limit(1)
      .get(),
    db
      .collection('taskInstances')
      .where('userId', '==', oldUid)
      .where('familyId', '==', familyId)
      .get(),
  ]);

  // wallet：新 uid 已有 wallet 就把舊餘額併入並刪舊；否則直接改 userId
  const existingNewWallet = newWalletQ.empty ? null : newWalletQ.docs[0];
  for (const w of walletQ.docs) {
    if (existingNewWallet) {
      const oldBal = (w.data().balance as number) || 0;
      batch.update(existingNewWallet.ref, {
        balance: admin.firestore.FieldValue.increment(oldBal),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.delete(w.ref);
    } else {
      batch.update(w.ref, { userId: newUid });
    }
  }

  // instances：若 doc id 是 seedDevTasks 的 `*_today_${oldUid}` 慣例，
  // 重建成 `*_today_${newUid}`（讓 seedDevTasks 的 exists 檢查命中、不重 seed）；
  // 其他 id 樣式只改 userId 欄位。
  for (const inst of instQ.docs) {
    const d = inst.data();
    const suffix = `_${oldUid}`;
    if (inst.id.endsWith(suffix)) {
      const newId = inst.id.slice(0, -suffix.length) + `_${newUid}`;
      batch.set(db.collection('taskInstances').doc(newId), {
        ...d,
        userId: newUid,
      });
      batch.delete(inst.ref);
    } else {
      batch.update(inst.ref, { userId: newUid });
    }
  }

  await batch.commit();
  return { wallets: walletQ.size, instances: instQ.size };
}

export const redeemInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const { code } = request.data as { code: string };
  if (!code || typeof code !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing code');
  }

  const codeRef = db.collection('inviteCodes').doc(code.toUpperCase());

  const result = await db.runTransaction(async (tx) => {
    const codeDoc = await tx.get(codeRef);
    if (!codeDoc.exists) {
      throw new HttpsError('not-found', 'INVALID_CODE');
    }
    const data = codeDoc.data()!;

    if (data.used) {
      throw new HttpsError('failed-precondition', 'CODE_USED');
    }
    if (data.expiresAt.toDate() < new Date()) {
      throw new HttpsError('failed-precondition', 'CODE_EXPIRED');
    }

    const familyId = data.familyId as string;

    // placeholder membership ref（孩子碼才需要，先在寫入前讀完）
    const placeholderRef =
      data.role === 'parent'
        ? null
        : db
            .collection('familyMemberships')
            .doc(`${data.childUserId}_${familyId}`);
    const placeholderSnap = placeholderRef ? await tx.get(placeholderRef) : null;

    // 讀 child user doc 取舊綁定 uid（重綁遷移用）。佔位帳號 authProviderId
    // 為 '' → 視為無舊綁定。所有讀取都在寫入前完成。
    let prevUid: string | null = null;
    if (data.role !== 'parent') {
      const userSnap = await tx.get(
        db.collection('users').doc(data.childUserId)
      );
      const p = userSnap.exists
        ? (userSnap.data()?.authProviderId as string | undefined)
        : undefined;
      prevUid = p && p !== uid ? p : null;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (data.role === 'parent') {
      tx.set(db.collection('familyMemberships').doc(`${uid}_${familyId}`), {
        familyId,
        userId: uid,
        role: 'parent',
        status: 'active',
        invitedBy: data.invitedBy || null,
        joinedAt: now,
      });
    } else {
      // authUid 寫進 placeholder child user doc
      tx.update(db.collection('users').doc(data.childUserId), {
        authProviderId: uid,
      });
      // 真實 authUid 的 membership（rules 用 ${uid}_${familyId} 查 isFamilyMember）。
      // 帶過 placeholder 上家長設定的 nickname / avatarEmoji，否則綁定後
      // 家長設的暱稱/頭像會掉。
      const ph = placeholderSnap?.exists ? placeholderSnap.data() : null;
      tx.set(db.collection('familyMemberships').doc(`${uid}_${familyId}`), {
        familyId,
        userId: uid,
        role: 'child',
        status: 'active',
        invitedBy: null,
        joinedAt: now,
        nickname: ph?.nickname ?? null,
        avatarEmoji: ph?.avatarEmoji ?? null,
      });
      // placeholder membership 標記 removed（存在才動，避免重複顯示）
      if (placeholderRef && placeholderSnap && placeholderSnap.exists) {
        tx.update(placeholderRef, { status: 'removed' });
      }
    }

    tx.update(codeRef, { used: true });

    return {
      childUserId: (data.childUserId as string) || uid,
      familyId,
      prevUid,
    };
  });

  // 重綁遷移（transaction 外，best-effort，不擋兌換成功）
  if (result.prevUid && result.prevUid !== uid) {
    try {
      const m = await migrateChildData(result.prevUid, uid, result.familyId);
      logger.info('[redeemInvite][migrate]', {
        oldUid: result.prevUid,
        newUid: uid,
        familyId: result.familyId,
        ...m,
      });
    } catch (e: any) {
      logger.warn('[redeemInvite][migrate] failed (non-fatal)', {
        oldUid: result.prevUid,
        newUid: uid,
        error: e?.message,
      });
    }
  }

  return { childUserId: result.childUserId, familyId: result.familyId };
});
