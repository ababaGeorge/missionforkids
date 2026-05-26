import { sendInviteEmail } from '../sendInviteEmail';

describe('sendInviteEmail', () => {
  it('用注入的 fetch 打 Resend，帶 Bearer key、收件人、deep link', async () => {
    const calls: any[] = [];
    const fakeFetch = jest.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ id: 'email-1' }) } as any;
    });

    await sendInviteEmail(
      {
        to: 'kid@example.com',
        familyName: '我們家',
        inviteId: 'inv-123',
        apiKey: 're_test',
      },
      { fetchImpl: fakeFetch as any }
    );

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(calls[0].init.body);
    expect(body.to).toEqual(['kid@example.com']);
    expect(body.from).toContain('onboarding@resend.dev');
    expect(body.html).toContain('missionforkids://invite/inv-123');
    expect(body.subject).toContain('我們家');
  });

  it('Resend 回非 2xx 時 throw', async () => {
    const fakeFetch = jest.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => 'invalid',
    })) as any;

    await expect(
      sendInviteEmail(
        { to: 'x@e.com', familyName: 'F', inviteId: 'i', apiKey: 'k' },
        { fetchImpl: fakeFetch }
      )
    ).rejects.toThrow(/resend/i);
  });
});
