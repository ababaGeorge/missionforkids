import firestore from '@react-native-firebase/firestore';

/**
 * 產生 6 位英數邀請碼（大寫，排除易混淆字元 0OIL1）
 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * 為孩子建立邀請碼，24 小時後過期
 */
export async function createInviteCode(
  childUserId: string,
  familyId: string
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await firestore().collection('inviteCodes').doc(code).set({
    childUserId,
    familyId,
    expiresAt: firestore.Timestamp.fromDate(expiresAt),
    used: false,
  });

  return code;
}

export interface InviteCodeData {
  childUserId: string;
  familyId: string;
}

/**
 * 驗證並兌換邀請碼
 * - 檢查碼是否存在、未使用、未過期
 * - 將 authUid 寫入 child user doc 的 authProviderId
 * - 標記碼為已使用
 */
export async function redeemInviteCode(
  code: string,
  authUid: string
): Promise<InviteCodeData> {
  const codeDoc = await firestore()
    .collection('inviteCodes')
    .doc(code.toUpperCase())
    .get();

  if (!codeDoc.exists) {
    throw new Error('INVALID_CODE');
  }

  const data = codeDoc.data()!;

  if (data.used) {
    throw new Error('CODE_USED');
  }

  if (data.expiresAt.toDate() < new Date()) {
    throw new Error('CODE_EXPIRED');
  }

  // 將 auth UID 寫入 child user doc
  await firestore().collection('users').doc(data.childUserId).update({
    authProviderId: authUid,
  });

  // 標記碼為已使用
  await codeDoc.ref.update({ used: true });

  return {
    childUserId: data.childUserId,
    familyId: data.familyId,
  };
}
