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
    const userRef = db.collection('users').doc(uid);
    const childId = uid; // childId 預設 = 當下 uid

    // --- 所有 read 都在任何 write 之前 ---
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) {
      throw new HttpsError('not-found', 'INVALID_INVITE');
    }
    const invite = inviteSnap.data()!;
    const familyId = invite.familyId as string;

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

    const memRef = db.collection('familyMemberships').doc(`${uid}_${familyId}`);
    const walletRef = db.collection('pointWallets').doc(`${familyId}_${childId}`);
    const [userSnap, memSnap, walletSnap] = [
      await tx.get(userRef),
      await tx.get(memRef),
      await tx.get(walletRef),
    ];

    // 既有家長不可因接受一張「child 邀請」而被降級 / 洗掉 profile。
    if (userSnap.exists && userSnap.data()?.roleType === 'parent') {
      throw new HttpsError('failed-precondition', 'ALREADY_PARENT');
    }

    const profile = invite.childProfile ?? {};

    // user doc：不存在才建（避免重複接受第二張邀請時整份覆寫既有 profile）。
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

    // membership：不存在才建（已是成員 → 保留既有暱稱/頭像/狀態，不重置）。
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
    }

    // 確定性錢包 {familyId}_{childId}。**只在不存在時建 balance:0**，
    // 否則重複接受同 email 的第二張邀請會把已累積的點數歸零（資料遺失）。
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
