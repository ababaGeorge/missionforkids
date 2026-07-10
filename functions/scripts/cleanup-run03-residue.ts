/* eslint-disable no-console */
//
// Cleanup Run 03 認列的 dev-family-seed 測試殘留（2026-07-10 使用者授權）。
//
// 只動 EXPLICIT doc id、且每項動手前先驗證欄位符合預期（沿用 cleanup-anon-dev-data
// 的顯式標記原則，codex #12）——任何一項現況與預期不符就跳過該項並警告，不猜。
//
// 範圍（對照 docs/testing/results/2026-07-10-test-run-03.md 與 R2-28 清單）：
//   刪除 rewardOrders/dev-order-ice-dev-kid1、dev-order-ice-dev-kid2（rejected 測試訂單）
//   刪除 taskInstances/LQq5j91Wh6EDOiJKXpf4、w0yWvB6sXeI9L0u4fvNQ
//     （「整理房間」同期重複 instance；保留已發點的 4h4om0ktsWitI1vxA5XS）
//   刪除 taskInstances/xQ1YHrh7cH0bQp8D0eCc ＋ tasks/rSiDfFFkRZHfvnmnDBMH（「測試任務」）
//   復原 rewardItems/dev-reward-game：archived → active（種子品項回復原狀，不刪）
// 不動：TestFamily2（留作第二家庭 fixture）、Kid3、所有錢包與 pointTransactions。
//
// Auth: Application Default Credentials (gcloud auth application-default login)。
// Run:
//   cd functions && node --experimental-strip-types scripts/cleanup-run03-residue.ts            # DRY RUN
//   cd functions && node --experimental-strip-types scripts/cleanup-run03-residue.ts --execute  # 執行

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin') as typeof import('firebase-admin');

const EXECUTE = process.argv.includes('--execute');
const PROJECT_ID = 'mission-for-kids';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

type Expect = Record<string, unknown>;

// 每項：路徑 + 動手前必須成立的欄位現況 + 動作
const PLAN: { path: string; expect: Expect; action: 'delete' | 'restore-active'; note: string }[] = [
  {
    path: 'rewardOrders/dev-order-ice-dev-kid1',
    expect: { status: 'rejected', familyId: 'dev-family-seed' },
    action: 'delete',
    note: '舊測試訂單（rejected）',
  },
  {
    path: 'rewardOrders/dev-order-ice-dev-kid2',
    expect: { status: 'rejected', familyId: 'dev-family-seed' },
    action: 'delete',
    note: '舊測試訂單（rejected）',
  },
  {
    path: 'taskInstances/LQq5j91Wh6EDOiJKXpf4',
    expect: { taskId: '8bqDpZJjV44fDoYK0GR5', status: 'rejected', familyId: 'dev-family-seed' },
    action: 'delete',
    note: '整理房間重複 instance（stale 快照產物，rejected）',
  },
  {
    path: 'taskInstances/w0yWvB6sXeI9L0u4fvNQ',
    expect: { taskId: '8bqDpZJjV44fDoYK0GR5', status: 'pending', familyId: 'dev-family-seed' },
    action: 'delete',
    note: '整理房間重複 instance（stale 快照產物，pending）',
  },
  {
    path: 'taskInstances/xQ1YHrh7cH0bQp8D0eCc',
    expect: { taskId: 'rSiDfFFkRZHfvnmnDBMH', status: 'pending', familyId: 'dev-family-seed' },
    action: 'delete',
    note: '「測試任務」的 instance',
  },
  {
    path: 'tasks/rSiDfFFkRZHfvnmnDBMH',
    expect: { title: '測試任務', status: 'archived', familyId: 'dev-family-seed' },
    action: 'delete',
    note: 'R2 實測建立的「測試任務」（archived）',
  },
  {
    path: 'rewardItems/dev-reward-game',
    expect: { title: '遊戲 30 分鐘', status: 'archived', familyId: 'dev-family-seed' },
    action: 'restore-active',
    note: '種子品項復原 active（S5 實測時封存的）',
  },
];

async function main() {
  console.log(EXECUTE ? '== EXECUTE 模式 ==' : '== DRY RUN（加 --execute 才會動資料）==');
  let ok = 0;
  let skipped = 0;

  for (const item of PLAN) {
    const ref = db.doc(item.path);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`SKIP  ${item.path} — 文件不存在（可能已清過）`);
      skipped++;
      continue;
    }
    const data = snap.data() ?? {};
    const mismatch = Object.entries(item.expect).find(([k, v]) => data[k] !== v);
    if (mismatch) {
      console.warn(
        `SKIP  ${item.path} — 欄位不符預期：${mismatch[0]}=${JSON.stringify(data[mismatch[0]])}（預期 ${JSON.stringify(mismatch[1])}）`,
      );
      skipped++;
      continue;
    }
    if (item.action === 'delete') {
      console.log(`${EXECUTE ? 'DELETE' : 'would DELETE'}  ${item.path} — ${item.note}`);
      if (EXECUTE) await ref.delete();
    } else {
      console.log(`${EXECUTE ? 'UPDATE' : 'would UPDATE'}  ${item.path} status→active — ${item.note}`);
      if (EXECUTE) await ref.update({ status: 'active' });
    }
    ok++;
  }

  console.log(`\n完成：${ok} 項${EXECUTE ? '已執行' : '待執行'}、${skipped} 項跳過。`);
  if (!EXECUTE) console.log('確認無誤後加 --execute 重跑。');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
