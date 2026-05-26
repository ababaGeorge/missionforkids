import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { sendInviteEmail } from './lib/sendInviteEmail';

const resendApiKey = defineSecret('RESEND_API_KEY');

const INVITE_TTL_DAYS = 7;

export const createFamilyInvite = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'unauthenticated: 必須先登入');
    }
    const familyId = String(request.data?.familyId ?? '').trim();
    const email = String(request.data?.email ?? '').trim().toLowerCase();
    const childName = String(request.data?.childName ?? '').trim();
    const nickname = request.data?.nickname ? String(request.data.nickname).trim() : null;
    const avatarEmoji = request.data?.avatarEmoji ? String(request.data.avatarEmoji) : null;
    if (!familyId || !email || !childName) {
      throw new HttpsError('invalid-argument', 'familyId / email / childName 必填');
    }

    const db = admin.firestore();

    // 驗證 caller 是該 family 的 active parent
    const memSnap = await db
      .collection('familyMemberships')
      .doc(`${uid}_${familyId}`)
      .get();
    const mem = memSnap.exists ? memSnap.data() : null;
    if (!mem || mem.role !== 'parent' || mem.status !== 'active') {
      throw new HttpsError('permission-denied', 'permission-denied: 只有家庭家長可以邀請');
    }

    const famSnap = await db.collection('families').doc(familyId).get();
    const familyName = (famSnap.data()?.displayName as string) || '家庭';

    const now = admin.firestore.FieldValue.serverTimestamp();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const inviteRef = db.collection('familyInvites').doc();
    await inviteRef.set({
      email,
      familyId,
      role: 'child',
      invitedBy: uid,
      status: 'pending',
      childProfile: { displayName: childName, nickname, avatarEmoji },
      acceptedBy: null,
      createdAt: now,
      expiresAt,
    });

    // 寄信 best-effort：失敗不 rollback invite，回傳可重寄
    let emailSent = false;
    try {
      await sendInviteEmail({
        to: email,
        familyName,
        inviteId: inviteRef.id,
        apiKey: resendApiKey.value(),
      });
      emailSent = true;
    } catch (e: any) {
      logger.warn('[createFamilyInvite] 寄信失敗 (non-fatal)', {
        inviteId: inviteRef.id,
        error: e?.message,
      });
    }

    return { inviteId: inviteRef.id, emailSent };
  }
);
