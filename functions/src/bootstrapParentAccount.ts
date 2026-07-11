import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const bootstrapParentAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'unauthenticated: 必須先登入');
  const displayName = String(request.data?.displayName ?? '').trim();
  const familyName = String(request.data?.familyName ?? '').trim();
  // displayName 只在首次建 user doc 時必填（交易內檢查）：family.tsx 的
  // 「已有帳號、無家庭」路徑改走本 CF 後，user doc 已存在、不需也不該重寫。
  if (!familyName) throw new HttpsError('invalid-argument', 'familyName 必填');
  const email = (request.auth?.token?.email as string | undefined) ?? null;
  const db = admin.firestore();
  const now = FieldValue.serverTimestamp();
  return db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await tx.get(userRef);
    if (userSnap.exists && userSnap.data()?.roleType === 'parent') {
      const existing = await db.collection('familyMemberships')
        .where('userId', '==', uid).where('role', '==', 'parent').where('status', '==', 'active').limit(1).get();
      if (!existing.empty) return { familyId: existing.docs[0].data().familyId as string };
    }
    // 既有小孩帳號不可自助升級成家長：孤兒恢復路徑（ensureAuthUser）讓小孩用自己的
    // email/密碼從註冊畫面打到這裡，放行會讓小孩另建新家庭、以 parent membership
    // 取得家長權限。鏡像 acceptFamilyInvite 的 ALREADY_PARENT 守衛。
    if (userSnap.exists && userSnap.data()?.roleType === 'child') {
      throw new HttpsError('failed-precondition', 'ALREADY_CHILD');
    }
    // legacy 帳號（doc id ≠ uid，靠 authProviderId 匹配——useAuth fallback 存在的理由）
    // 讀 users/{uid} 讀不到，上方守衛會被跳過 → 補用 authProviderId 查一次。
    // 此 read 在所有 write 之前，符合 transaction read-before-write 規則。
    if (!userSnap.exists) {
      const legacySnap = await tx.get(
        db.collection('users').where('authProviderId', '==', uid).limit(1)
      );
      if (!legacySnap.empty && legacySnap.docs[0].data()?.roleType === 'child') {
        throw new HttpsError('failed-precondition', 'ALREADY_CHILD');
      }
    }
    // R3-2：建家庭前擋任何家庭的 active membership（不分角色）——一帳號一家庭。
    // 既有 parent 的冪等短路在最前（roleType 檢查）已回傳既有 familyId，不會走到這裡。
    // equality-only 查詢不需新複合索引；此 read 在所有 write 之前（transaction 規則）。
    const activeMemsSnap = await tx.get(
      db
        .collection('familyMemberships')
        .where('userId', '==', uid)
        .where('status', '==', 'active')
    );
    if (!activeMemsSnap.empty) {
      throw new HttpsError('failed-precondition', 'ALREADY_IN_FAMILY');
    }
    const familyRef = db.collection('families').doc();
    // user doc 已存在（例：家長被移出家庭後從 family 頁重建家庭）→ 保留原 doc，
    // 不整份覆寫（避免洗掉 birthday/avatarUrl/createdAt）。只有首次註冊才建 user doc。
    if (!userSnap.exists) {
      if (!displayName) throw new HttpsError('invalid-argument', 'displayName 必填（首次建立帳號）');
      tx.set(userRef, { displayName, avatarUrl: null, authProvider: 'password', authProviderId: uid, roleType: 'parent', email, birthday: null, createdAt: now });
    }
    tx.set(familyRef, { displayName: familyName, defaultGraceDays: 2, createdBy: uid, createdAt: now });
    tx.set(db.collection('familyMemberships').doc(`${uid}_${familyRef.id}`), { familyId: familyRef.id, userId: uid, role: 'parent', status: 'active', invitedBy: uid, joinedAt: now });
    return { familyId: familyRef.id };
  });
});
