import { Timestamp } from 'firebase-admin/firestore';

export type Frequency = 'once' | 'daily' | 'weekly' | 'monthly';

function toDate(ts: any): Date {
  if (ts instanceof Date) return ts;
  if (ts && typeof ts.toDate === 'function') return ts.toDate();
  if (ts && typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
  return new Date(ts);
}
function toMillis(ts: any): number {
  return toDate(ts).getTime();
}

/**
 * 從「上一期截止日」推算「下一期截止日」，保持原本的時刻（23:59 語意）。
 * 對照 docs/任務系統模組決策文件_v1.0.md 3-1/3-2：
 *   每日：+1 天｜每週：+7 天（保留星期幾）
 *   每月：同號次月；30/31（即上一期落在月底）→ 一律抓次月最後一天；
 *         其餘號數若次月無此日則抓月底。
 * once 不重生 → 回 null。
 */
export function computeNextDue(frequency: Frequency, prevDue: Date): Date | null {
  const H = prevDue.getHours();
  const Mi = prevDue.getMinutes();
  const S = prevDue.getSeconds();

  if (frequency === 'daily') {
    const d = new Date(prevDue);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (frequency === 'weekly') {
    const d = new Date(prevDue);
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (frequency === 'monthly') {
    const y = prevDue.getFullYear();
    const m = prevDue.getMonth();
    const day = prevDue.getDate();
    const lastDayThisMonth = new Date(y, m + 1, 0).getDate();
    const lastDayNextMonth = new Date(y, m + 2, 0).getDate();
    // 上一期落在月底 → 視為「每月最後一天」，次月同樣抓最後一天。
    const isEom = day === lastDayThisMonth;
    const nextDay = isEom ? lastDayNextMonth : Math.min(day, lastDayNextMonth);
    return new Date(y, m + 1, nextDay, H, Mi, S);
  }
  return null;
}

export interface RolloverResult {
  created: number;
  missed: number;
}

/**
 * 週期任務結算：對每個 active 週期任務的每位小孩，
 * 若「本期（含補交期）已結束」則：
 *   - pending / rejected → 記為 missed（不補做、不懲罰，docs 決策）
 *   - submitted → 保持不動（仍等家長審核，上一期繼續存活）
 *   - approved → 已終結
 * 然後建立下一期 pending instance（冪等：已存在同 periodEnd 的 instance 則不重建）。
 *
 * 「家長刪除任務」在本 App 是 archive（status != 'active'），排程會跳過 →
 * 等同「停止後續週期」；要保留週期就別 archive。
 *
 * 另：只替「仍是本家庭 active 成員」的小孩推進——被移除的小孩（membership
 * status='removed' 或不存在）舊 instance 會被 skip，不標 missed 也不建下一期，
 * 避免孤兒幽靈任務無限累積。
 *
 * 單次執行對每位小孩只推進一期；排程每日觸發會自然趕上（正常使用下每次至多過一期）。
 */
export async function rolloverRecurringTasks(
  db: FirebaseFirestore.Firestore,
  now: Date
): Promise<RolloverResult> {
  const result: RolloverResult = { created: 0, missed: 0 };

  const tasksSnap = await db.collection('tasks').where('status', '==', 'active').get();

  for (const taskDoc of tasksSnap.docs) {
    const task = taskDoc.data();
    const frequency = task.frequency as Frequency;
    if (frequency !== 'daily' && frequency !== 'weekly' && frequency !== 'monthly') continue;

    const graceDays = typeof task.graceDays === 'number' ? task.graceDays : 2;
    const familyId = task.familyId as string;

    const instSnap = await db
      .collection('taskInstances')
      .where('taskId', '==', taskDoc.id)
      .get();
    if (instSnap.empty) continue;

    // 依 userId 分組
    const byUser = new Map<string, any[]>();
    for (const d of instSnap.docs) {
      const inst = { id: d.id, ref: d.ref, ...(d.data() as any) };
      const arr = byUser.get(inst.userId) ?? [];
      arr.push(inst);
      byUser.set(inst.userId, arr);
    }

    for (const [userId, list] of byUser) {
      // 幽靈任務防線：只替「仍是本家庭 active 成員」的小孩推進週期。
      // 被移除的小孩（membership status='removed' 或整筆不存在）舊 instance 殘留，
      // 若照舊推進會每期替孤兒建新 pending → 無限累積、家長端看到幽靈任務。
      // 用確定性 doc id 查 membership（比照 grantPoints.ts 驗 active 成員的方式）。
      const memberFamilyId = familyId ?? (list[0]?.familyId as string);
      const memberDoc = await db
        .collection('familyMemberships')
        .doc(`${userId}_${memberFamilyId}`)
        .get();
      const memberData = memberDoc.data();
      if (!memberDoc.exists || memberData?.status !== 'active') continue;

      // 最新一期 = periodEnd 最大者
      list.sort((a, b) => toMillis(b.periodEnd) - toMillis(a.periodEnd));
      const latest = list[0];
      const graceEnd = toDate(latest.gracePeriodEnd);
      if (now.getTime() <= graceEnd.getTime()) continue; // 本期含補交期尚未結束

      if (latest.status === 'pending' || latest.status === 'rejected') {
        await latest.ref.update({ status: 'missed' });
        result.missed += 1;
      }

      const prevDue = toDate(latest.periodEnd);
      const nextDue = computeNextDue(frequency, prevDue);
      if (!nextDue) continue;

      // 冪等快速路徑：已存在同一期（periodEnd 相同，1 秒容差）則不重建。
      // 這只是常見情況的省事檢查；真正的防線是下方 .create() 的確定性 doc id——
      // 並發重複觸發時，兩個執行各自讀到寫入前快照都會通過這個 in-memory 檢查，
      // 唯有 Firestore 層對同一 doc id 的 create 才會擋掉第二筆（避免同期雙倍點）。
      const dup = list.some(
        (i) => Math.abs(toMillis(i.periodEnd) - nextDue.getTime()) < 1000
      );
      if (dup) continue;

      const nextGraceEnd = new Date(nextDue.getTime() + graceDays * 86400000);
      // 確定性 doc id（比照 grantPoints / onRewardOrderCreated 的冪等慣例）：
      // 同一 task × 同一 user × 同一期只會有唯一 id。並發時第二個 create 會拋
      // ALREADY_EXISTS（code 6），視為冪等成功（不重複計 created、不重拋）。
      const nextId = `${taskDoc.id}_${userId}_${nextDue.getTime()}`;
      try {
        await db.collection('taskInstances').doc(nextId).create({
          taskId: taskDoc.id,
          userId,
          childId: latest.childId ?? userId,
          familyId: memberFamilyId,
          periodStart: Timestamp.fromDate(prevDue),
          periodEnd: Timestamp.fromDate(nextDue),
          gracePeriodEnd: Timestamp.fromDate(nextGraceEnd),
          status: 'pending',
          submissionCount: 0,
          reviewedBy: null,
          reviewedAt: null,
          pointsAwarded: null,
        });
        result.created += 1;
      } catch (e: any) {
        // code 6 = ALREADY_EXISTS：另一並發執行已建同期 → 冪等成功，吞掉。其他錯照拋。
        if (e?.code !== 6) throw e;
      }
    }
  }

  return result;
}
