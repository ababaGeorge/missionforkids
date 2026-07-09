import { joinDurationLabel } from '../joinDuration';

describe('joinDurationLabel', () => {
  const now = new Date('2026-07-09T12:00:00+08:00');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  it('第 0 天 → 今天加入（不再顯示「加入 1 個月」）', () => {
    expect(joinDurationLabel(daysAgo(0), now)).toBe('今天加入');
  });

  it('5 天 → 加入 5 天', () => {
    expect(joinDurationLabel(daysAgo(5), now)).toBe('加入 5 天');
  });

  it('35 天 → 加入 1 個月', () => {
    expect(joinDurationLabel(daysAgo(35), now)).toBe('加入 1 個月');
  });

  it('createdAt 無效 → null（畫面直接不顯示）', () => {
    expect(joinDurationLabel(new Date('invalid'), now)).toBeNull();
  });
});
