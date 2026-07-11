import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * R3-3：移除家庭成員（原子完成「membership 標 removed」＋「作廢該成員的 pending 邀請」）。
 * client 直改 status:'removed' 已被 firestore.rules 禁止——移除只能走這裡。
 *
 * 守衛順序（對齊 R3 計畫 §3）：
 *   已登入 → caller 是該家庭 active parent（NOT_PARENT）
 *   → 目標 membership 存在且 active（MEMBER_NOT_FOUND）
 *   → 不能移除自己（CANNOT_REMOVE_SELF）
 *   → 目標必須是 child（ONLY_CHILD_REMOVABLE；家長互移等 co-parent 政策設計後再放寬）
 */
export const removeFamilyMember = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'unauthenticated: 必須先登入');
  }
  const familyId = String(request.data?.familyId ?? '').trim();
  const memberUserId = String(request.data?.memberUserId ?? '').trim();
  if (!familyId || !memberUserId) {
    throw new HttpsError('invalid-argument', 'familyId / memberUserId 必填');
  }

  const db = admin.firestore();
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async (tx) => {
    // --- 所有 read 在任何 write 之前（Firestore transaction 規則） ---
    const callerMemRef = db
      .collection('familyMemberships')
      .doc(`${callerUid}_${familyId}`);
    const targetMemRef = db
      .collection('familyMemberships')
      .doc(`${memberUserId}_${familyId}`);

    const callerSnap = await tx.get(callerMemRef);
    const caller = callerSnap.exists ? callerSnap.data()! : null;
    if (!caller || caller.role !== 'parent' || caller.status !== 'active') {
      throw new HttpsError('permission-denied', 'NOT_PARENT');
    }

    const targetSnap = await tx.get(targetMemRef);
    const target = targetSnap.exists ? targetSnap.data()! : null;
    if (!target || target.status !== 'active') {
      throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
    }

    if (memberUserId === callerUid) {
      throw new HttpsError('failed-precondition', 'CANNOT_REMOVE_SELF');
    }

    if (target.role !== 'child') {
      throw new HttpsError('failed-precondition', 'ONLY_CHILD_REMOVABLE');
    }

    // 作廢邀請：以 user doc 的 email 匹配（invite.email 建立時已 lowercase）。
    const userSnap = await tx.get(db.collection('users').doc(memberUserId));
    let email =
      ((userSnap.data()?.email as string | undefined) ?? '').trim().toLowerCase() || null;

    // legacy 帳號（user doc id ≠ uid）：users/{memberUserId} 讀不到 →
    // 比照 acceptFamilyInvite 用 authProviderId 再查一次，避免「其實有 email
    // 卻走 NO_EMAIL_SKIP_REVOKE、pending 邀請沒被作廢」的一致性缺口。
    // 此 read 仍在所有 write 之前（Firestore transaction 規則）。
    if (!email) {
      const legacySnap = await tx.get(
        db.collection('users').where('authProviderId', '==', memberUserId).limit(1)
      );
      if (!legacySnap.empty) {
        email =
          (((legacySnap.docs[0].data()?.email as string | undefined) ?? '')
            .trim()
            .toLowerCase()) || null;
      }
    }
    // 到這裡仍無 email（真 legacy）→ 查不到匹配邀請，跳過作廢並回傳 warning。

    let inviteDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (email) {
      const invitesSnap = await tx.get(
        db
          .collection('familyInvites')
          .where('familyId', '==', familyId)
          .where('status', '==', 'pending')
          .where('email', '==', email)
      );
      inviteDocs = invitesSnap.docs;
    }

    // --- writes ---
    // joinedAt / childId / 暱稱等欄位保留（對齊 R2-29 reactivate 慣例：移除只動狀態欄）
    tx.update(targetMemRef, {
      status: 'removed',
      removedAt: now,
      removedBy: callerUid,
    });
    for (const d of inviteDocs) {
      tx.update(d.ref, {
        status: 'revoked',
        revokedAt: now,
        revokedBy: callerUid,
      });
    }

    if (!email) {
      return { removed: true, revokedInvites: 0, warning: 'NO_EMAIL_SKIP_REVOKE' };
    }
    return { removed: true, revokedInvites: inviteDocs.length };
  });
});
