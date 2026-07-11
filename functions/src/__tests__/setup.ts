import * as admin from 'firebase-admin';

// 安全閘：afterEach 會清空「整個資料庫的所有集合」，絕不允許連上 production。
// 必須透過 `npm test`（firebase emulators:exec 會注入這兩個環境變數）執行。
// 2026-07-11 事故：jest 被直接執行（未經 emulators:exec），admin SDK 走 ADC 連上
// prod，afterEach 把正式資料庫整個清空。此閘與 core-loop-e2e.cjs 的防護同款。
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error(
    '拒絕執行：未偵測到 FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST。' +
      '請用 `npm test`（firebase emulators:exec）跑測試，避免誤連 production。'
  );
}

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'mission-for-kids' });
}
afterEach(async () => {
  const db = admin.firestore();
  const collections = await db.listCollections();
  await Promise.all(
    collections.map(async (c) => {
      const docs = await c.listDocuments();
      await Promise.all(docs.map((d) => d.delete()));
    })
  );
});
