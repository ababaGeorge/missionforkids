export interface SendInviteEmailParams {
  to: string;
  familyName: string;
  inviteId: string;
  apiKey: string;
}

export interface SendInviteEmailDeps {
  fetchImpl?: typeof fetch;
}

// 測試階段用 onboarding@resend.dev（免驗證網域）；上線前換自有寄件網域。
const FROM = 'Mission for Kids <onboarding@resend.dev>';

export async function sendInviteEmail(
  params: SendInviteEmailParams,
  deps: SendInviteEmailDeps = {}
): Promise<void> {
  const doFetch = deps.fetchImpl ?? globalThis.fetch;
  const link = `missionforkids://invite/${params.inviteId}`;
  const html =
    `<p>你被邀請加入「${params.familyName}」。</p>` +
    `<p><a href="${link}">點此開啟 Mission for Kids 接受邀請</a></p>` +
    `<p>若連結無法點擊，請複製：${link}</p>`;

  const res = await doFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [params.to],
      subject: `邀請你加入「${params.familyName}」`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = typeof res.text === 'function' ? await res.text() : '';
    throw new Error(`Resend 寄信失敗 (${res.status}): ${detail}`);
  }
}
