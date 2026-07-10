import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const acceptFamilyInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'unauthenticated: 必須先登入');
  }
  const inviteId = String(request.data?.inviteId ?? '').trim();
  if (!inviteId) {
    throw new HttpsError('invalid-argument', 'inviteId 必填');
  }
  const email = (request.auth?.token?.email as string | undefined) ?? null;
  const db = admin.firestore();
  const now = FieldValue.serverTimestamp();

  return db.runTransaction(async (tx) => {
    const inviteRef = db.collection('familyInvites').doc(inviteId);
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) {
      throw new HttpsError('not-found', 'INVALID_INVITE');
    }
    const invite = inviteSnap.data()!;
    const familyId = invite.familyId as string;
    const childId = uid; // childId 預設 = 當下 uid

    // 冪等：同一 uid 已接受過 → 回傳既有
    if (invite.status === 'accepted') {
      if (invite.acceptedBy === uid) {
        return { familyId, childId };
      }
      throw new HttpsError('failed-precondition', 'INVITE_ALREADY_USED');
    }
    if (invite.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'INVITE_ALREADY_USED');
    }
    if ((invite.expiresAt as Timestamp).toDate() < new Date()) {
      throw new HttpsError('failed-precondition', 'INVITE_EXPIRED');
    }

    // email 必須與邀請相符：邀請寄到特定 email，該 email 就是擁有權證明。
    // 擋掉「inviteId 外洩/被轉寄 → 他人用自己帳號冒用加入家庭」。
    // invite.email 已是小寫（createFamilyInvite 存入前 lowercase）。
    const inviteEmail = (invite.email as string | undefined) ?? null;
    if (inviteEmail && (email ?? '').toLowerCase() !== inviteEmail) {
      throw new HttpsError('permission-denied', 'INVITE_EMAIL_MISMATCH');
    }

    // --- 後續 read 必須全部在任何 write 之前（Firestore transaction 規則） ---
    const userRef = db.collection('users').doc(uid);
    const memRef = db.collection('familyMemberships').doc(`${uid}_${familyId}`);
    const walletRef = db.collection('pointWallets').doc(`${familyId}_${childId}`);
    const userSnap = await tx.get(userRef);
    const memSnap = await tx.get(memRef);
    const walletSnap = await tx.get(walletRef);

    // legacy 帳號（doc id ≠ uid，靠 authProviderId 匹配——useAuth fallback 存在的理由）
    // 讀 users/{uid} 讀不到，下方 ALREADY_PARENT 守衛會被跳過 → 補用 authProviderId 查一次。
    // 此 read 在所有 write 之前，符合 transaction read-before-write 規則。
    let legacyRoleType: string | null = null;
    if (!userSnap.exists) {
      const legacySnap = await tx.get(
        db.collection('users').where('authProviderId', '==', uid).limit(1)
      );
      if (!legacySnap.empty) {
        legacyRoleType = (legacySnap.docs[0].data()?.roleType as string | undefined) ?? null;
      }
    }

    // 既有家長不可因接受一張 child 邀請而被降級 / 洗掉 profile。
    if ((userSnap.exists && userSnap.data()?.roleType === 'parent') || legacyRoleType === 'parent') {
      throw new HttpsError('failed-precondition', 'ALREADY_PARENT');
    }

    // R3-1：擋跨家庭雙 active membership——一個帳號同時只能屬於一個家庭。
    // 過濾掉本邀請的 familyId：同家庭 reactivate（被移除後重新受邀）不受影響。
    // 已 accepted 的冪等回傳在上方先行，不會被此守衛擋到。
    // equality-only 查詢不需新複合索引；此 read 在所有 write 之前（transaction 規則）。
    const activeMemsSnap = await tx.get(
      db
        .collection('familyMemberships')
        .where('userId', '==', uid)
        .where('status', '==', 'active')
    );
    if (activeMemsSnap.docs.some((d) => d.data()?.familyId !== familyId)) {
      throw new HttpsError('failed-precondition', 'ALREADY_IN_FAMILY');
    }

    const profile = invite.childProfile ?? {};

    // user doc：不存在才建（重複接受第二張邀請時不整份覆寫既有 profile）。
    if (!userSnap.exists) {
      tx.set(userRef, {
        displayName: profile.displayName ?? '小孩',
        avatarUrl: null,
        authProvider: 'password',
        authProviderId: uid,
        roleType: 'child',
        childId,
        email,
        birthday: null,
        createdAt: now,
      });
    }

    // membership：不存在才建（已是成員 → 保留既有暱稱/頭像/joinedAt，不重置）。
    if (!memSnap.exists) {
      tx.set(memRef, {
        familyId,
        userId: uid,
        childId,
        role: 'child',
        status: 'active',
        invitedBy: invite.invitedBy ?? null,
        joinedAt: now,
        nickname: profile.nickname ?? null,
        avatarEmoji: profile.avatarEmoji ?? null,
      });
    } else if (memSnap.data()?.status !== 'active') {
      // 被移除（status: 'removed'）的成員重新受邀 → 只把 status 復原成 active。
      // 不動 joinedAt / childId / 暱稱；錢包照「存在就不動」規則，點數保留。
      tx.update(memRef, { status: 'active' });
    }

    // 確定性錢包 {familyId}_{childId}；childId == uid，故 doc id 與既有 userId 慣例一致。
    // 同時寫 childId 與 userId，讓 Plan C 之前的「where userId == uid」讀取仍相容。
    // **只在不存在時建 balance:0**，否則重複接受第二張邀請會把已累積的點數歸零。
    if (!walletSnap.exists) {
      tx.set(walletRef, {
        childId,
        userId: uid,
        familyId,
        balance: 0,
        updatedAt: now,
      });
    }

    tx.update(inviteRef, { status: 'accepted', acceptedBy: uid });

    return { familyId, childId };
  });
});
