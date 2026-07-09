import { celebrationStep } from '../celebration';
import type { TaskInstanceStatus } from '../../types/models';

/** 模擬一串快照，回傳每次觸發的慶祝點數 */
function runSnapshots(
  frames: Array<{ status: TaskInstanceStatus; pointsAwarded: number | null }>
): number[] {
  const fired: number[] = [];
  let prev: TaskInstanceStatus | undefined;
  for (const f of frames) {
    const step = celebrationStep(prev, f.status, f.pointsAwarded);
    if (step.celebrate) fired.push(step.points);
    if (step.advance) prev = f.status;
  }
  return fired;
}

describe('celebrationStep', () => {
  it('submitted → approved(無點) → approved(+30)：只觸發一次、顯示 +30', () => {
    expect(
      runSnapshots([
        { status: 'submitted', pointsAwarded: null },
        { status: 'approved', pointsAwarded: null },
        { status: 'approved', pointsAwarded: 30 },
      ])
    ).toEqual([30]);
  });

  it('submitted → approved(+30)：只觸發一次、顯示 +30', () => {
    expect(
      runSnapshots([
        { status: 'submitted', pointsAwarded: null },
        { status: 'approved', pointsAwarded: 30 },
      ])
    ).toEqual([30]);
  });

  it('首次快照就是 approved（重進頁面）→ 不慶祝', () => {
    expect(runSnapshots([{ status: 'approved', pointsAwarded: 30 }])).toEqual([]);
    expect(
      runSnapshots([
        { status: 'approved', pointsAwarded: null },
        { status: 'approved', pointsAwarded: 30 },
      ])
    ).toEqual([]);
  });

  it('approved 後重複快照 → 不再觸發', () => {
    expect(
      runSnapshots([
        { status: 'submitted', pointsAwarded: null },
        { status: 'approved', pointsAwarded: 30 },
        { status: 'approved', pointsAwarded: 30 },
      ])
    ).toEqual([30]);
  });

  it('pointsAwarded 未到位時不推進 prevStatus（advance=false）', () => {
    const step = celebrationStep('submitted', 'approved', null);
    expect(step).toEqual({ celebrate: false, points: 0, advance: false });
  });

  it('rejected 等非 approved 轉換 → 不慶祝但照常推進', () => {
    expect(
      runSnapshots([
        { status: 'submitted', pointsAwarded: null },
        { status: 'rejected', pointsAwarded: null },
      ])
    ).toEqual([]);
  });
});
