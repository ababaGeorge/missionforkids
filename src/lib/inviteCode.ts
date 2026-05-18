import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

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
    role: 'child',
    expiresAt: firestore.Timestamp.fromDate(expiresAt),
    used: false,
  });

  return code;
}

/**
 * 為家長建立邀請碼，24 小時後過期
 * 家長用正式帳號（Google/Apple）登入後兌換
 */
export async function createParentInviteCode(
  familyId: string,
  invitedBy: string
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await firestore().collection('inviteCodes').doc(code).set({
    childUserId: null,
    familyId,
    role: 'parent',
    invitedBy,
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
 * 驗證並兌換邀請碼。
 *
 * 改為呼叫 server-side callable `redeemInvite`：client 端被 firestore rule
 * `users update: request.auth.uid == userId` 擋住，無法把 authUid 寫進家長
 * 建的 placeholder child user doc（小孩永遠綁不上 QQ/RR）。綁定改在
 * function 內用 admin 權限做。簽名與回傳、錯誤碼（INVALID_CODE /
 * CODE_USED / CODE_EXPIRED）維持不變，呼叫端不用改。
 *
 * authUid 參數保留以維持簽名相容；實際身分由 function 從 request.auth 取，
 * 不信任 client 傳入。
 */
export async function redeemInviteCode(
  code: string,
  _authUid: string
): Promise<InviteCodeData> {
  try {
    const fn = functions().httpsCallable('redeemInvite');
    const res = await fn({ code: code.toUpperCase() });
    return res.data as InviteCodeData;
  } catch (e: any) {
    // HttpsError 的 message 會原樣帶回（INVALID_CODE / CODE_USED /
    // CODE_EXPIRED），呼叫端用 error.message 比對，維持原行為。
    throw new Error(e?.message || 'INVALID_CODE');
  }
}
