import {
  INVITE_LINK_PREFIX,
  buildInviteLink,
  extractInviteId,
} from '../inviteLink';

// Firestore auto-id 長度 20，落在裸 id 規則的 15-40 區間內
const ID = 'AbC123xyz789QRSTuvw0';

describe('buildInviteLink', () => {
  it('PREFIX + inviteId', () => {
    expect(buildInviteLink(ID)).toBe(`missionforkids://invite/${ID}`);
    expect(buildInviteLink(ID)).toBe(INVITE_LINK_PREFIX + ID);
  });
});

describe('extractInviteId', () => {
  it('完整連結 → 取出 id', () => {
    expect(extractInviteId(`missionforkids://invite/${ID}`)).toBe(ID);
  });

  it('連結嵌在多行分享訊息中 → 取出 id', () => {
    const msg =
      `【Mission for Kids】邀請 小安 加入家庭\n` +
      `1. 在小孩的裝置打開 Mission for Kids App\n` +
      `2. 點登入頁的「我有邀請連結」\n` +
      `3. 貼上下面整段連結：\n` +
      `missionforkids://invite/${ID}\n` +
      `（連結 7 天內有效）`;
    expect(extractInviteId(msg)).toBe(ID);
  });

  it('連結尾隨標點或換行 → 只取 id 本體', () => {
    expect(extractInviteId(`missionforkids://invite/${ID}。`)).toBe(ID);
    expect(extractInviteId(`missionforkids://invite/${ID}）\n`)).toBe(ID);
  });

  it('多個連結 → 取第一個', () => {
    expect(
      extractInviteId(
        `missionforkids://invite/${ID} missionforkids://invite/other12345678901234`
      )
    ).toBe(ID);
  });

  it('裸 id（前後含空白）→ 直接回傳', () => {
    expect(extractInviteId(`  ${ID}  \n`)).toBe(ID);
  });

  it('裸字串太短（<15）→ null', () => {
    expect(extractInviteId('short-id-123')).toBeNull();
  });

  it('裸字串太長（>40）→ null', () => {
    expect(extractInviteId('a'.repeat(41))).toBeNull();
  });

  it('亂字串 → null', () => {
    expect(extractInviteId('這不是邀請連結 https://example.com/foo')).toBeNull();
  });

  it('空字串 / 純空白 → null', () => {
    expect(extractInviteId('')).toBeNull();
    expect(extractInviteId('   \n  ')).toBeNull();
  });
});
