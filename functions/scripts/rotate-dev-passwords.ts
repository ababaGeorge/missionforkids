/* eslint-disable no-console */
//
// A7 補刀：只改 3 個 dev 測試帳號的密碼，不碰任何 Firestore 資料。
//
// Why: 舊密碼 `mfk-dev-2026!` 已洩漏在 public repo。這支腳本對「既有帳號」重設
// 一組新密碼，讓洩漏的那組立刻失效，帳號保留可繼續測試。跟 seed 不同 —— 它
// 完全不動 family / tasks / wallets 等測試資料。
//
// A7 教訓：密碼絕不寫進原始碼，一律從環境變數傳入。
//
// 認證：Application Default Credentials（與 seed 相同）。若還沒設定過：
//   ! gcloud auth application-default login
//   ! gcloud auth application-default set-quota-project mission-for-kids
//
// 執行（在 functions/ 底下，密碼用 env 帶入，不會進 shell history 以外的地方）：
//   cd functions && DEV_SEED_PASSWORD='mfktest2026' node --experimental-strip-types scripts/rotate-dev-passwords.ts

import { createRequire } from 'node:module';

// firebase-admin 是 CommonJS；Node ESM type-stripping 下 namespace import
// (`import * as admin`) 拿不到成員，用 CJS require 載入。
const require = createRequire(import.meta.url);
const admin = require('firebase-admin') as typeof import('firebase-admin');

const PROJECT_ID = 'mission-for-kids';
const NEW_PASSWORD = process.env.DEV_SEED_PASSWORD;
if (!NEW_PASSWORD) {
  throw new Error('DEV_SEED_PASSWORD 環境變數必填（避免把密碼 commit 進原始碼）');
}
if (NEW_PASSWORD.length < 6) {
  throw new Error('Firebase 密碼至少 6 碼');
}
if (NEW_PASSWORD === 'mfk-dev-2026!') {
  throw new Error('這就是已洩漏的舊密碼，請換一組新的');
}

const UIDS = ['dev-parent', 'dev-kid1', 'dev-kid2'];

admin.initializeApp({ projectId: PROJECT_ID });
const auth = admin.auth();

async function rotate() {
  console.log(`\n▶ 改 ${UIDS.length} 個 dev 測試帳號密碼 @ ${PROJECT_ID}\n`);
  for (const uid of UIDS) {
    await auth.updateUser(uid, { password: NEW_PASSWORD });
    console.log(`  ✓ 密碼已更新：${uid}`);
  }
  console.log('\n✅ 完成。洩漏的舊密碼 mfk-dev-2026! 已失效，帳號保留可繼續測試。');
  console.log('   之後跑 Metro 用新密碼自動填入：EXPO_PUBLIC_DEV_PASSWORD=<新密碼> npx expo start\n');
}

rotate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('✗ 失敗：', e?.message ?? e);
    process.exit(1);
  });
