// 邀請連結的單一來源：組 deep link 與從分享訊息中解析 inviteId。
// 背景：試用家庭收不到邀請信（Resend sandbox 只能寄給開發者本人），
// 主要交付路徑改為家長分享連結、小孩端貼上整段訊息——所以解析要容忍
// 連結被嵌在多行文字、尾隨標點的情況。
export const INVITE_LINK_PREFIX = 'missionforkids://invite/';

export function buildInviteLink(inviteId: string): string {
  return INVITE_LINK_PREFIX + inviteId;
}

// 解析規則：
// (a) 整段文字中找第一個 missionforkids://invite/{id}（id 限 [A-Za-z0-9_-]，
//     所以尾隨的標點/換行自然被切掉）；
// (b) 沒找到、但整段 trim 後像裸 inviteId（15-40 字）→ 直接當 id；
// (c) 其餘回 null。
// charset 已排除 / 與空白，不會有路徑注入。
export function extractInviteId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/missionforkids:\/\/invite\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{15,40}$/.test(trimmed)) return trimmed;
  return null;
}
