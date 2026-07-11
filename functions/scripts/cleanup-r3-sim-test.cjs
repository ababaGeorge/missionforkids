/* R3 模擬器實測（2026-07-11）殘留清理 + 種子任務復原。
 *
 * 產生來源：R3 部署後模擬器實測（擋多家庭 / 移除成員 / 封存守衛）。
 * 全部為 dev 測試資料，無真實使用者。
 *
 * 動作：
 *   1) 復原被封存的兩個「整理書桌」種子任務 → status: 'active'
 *      （實測封存守衛時封存了它們；種子家庭應回復原狀）
 *   2) 刪除攻防測試寫入的孤兒 taskSubmission（無點數路徑，純垃圾 doc）
 *   3) 刪除 dev-kid4 測試小孩全套（membership/users/wallet/invites/auth）
 *   4) 刪除 TestFamily3 測試家庭全套（family/membership/users/rewards/invite/auth）
 *
 * 認證：gcloud ADC。跑法（DRY_RUN 預設只印不刪）：
 *   cd functions && node scripts/cleanup-r3-sim-test.cjs            # 預覽
 *   cd functions && DRY_RUN=0 node scripts/cleanup-r3-sim-test.cjs  # 實刪
 */
/* eslint-disable no-console */
const { createRequire } = require('module');
const require2 = createRequire(__filename);
const admin = require2('firebase-admin');

const DRY = process.env.DRY_RUN !== '0';
const tag = DRY ? '[DRY]' : '[EXEC]';

if (admin.apps.length === 0) admin.initializeApp({ projectId: 'mission-for-kids' });
const db = admin.firestore();
const auth = admin.auth();

const FAMILY = 'dev-family-seed';
const TESTFAM3 = '6zmqYNpihLft0l40qUfF';
const KID4_UID = 'RVt1rcsduSdwHan6XCAS4sTeqmu2';
const PARENT3_UID = 'T4ogrkSiy5YtTmMOZT8FRNy9AFQ2';
const ORPHAN_SUB = 'i62F9qJCzAROx2WRuw0A';
const REVIVE_TASKS = ['dev-task-desk-dev-kid1', 'dev-task-desk-dev-kid2'];
const DEAD_INVITES = ['QaDitkl1PzD5DSdiNzoy', 'vFyb5QEBx25wssx9Uaor', 'JqxMGylfnhdCT28BYtdh'];

async function reviveTask(id) {
  const ref = db.collection('tasks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`${tag} revive skip (不存在): ${id}`); return; }
  if (snap.data().status !== 'archived') { console.log(`${tag} revive skip (非封存): ${id}`); return; }
  console.log(`${tag} revive task→active: ${id}`);
  if (!DRY) await ref.update({ status: 'active' });
}

async function delDoc(path) {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`${tag} del skip (不存在): ${path}`); return; }
  console.log(`${tag} del doc: ${path}`);
  if (!DRY) await ref.delete();
}

async function delWhere(coll, field, value, label) {
  const qs = await db.collection(coll).where(field, '==', value).get();
  for (const d of qs.docs) {
    console.log(`${tag} del ${label}: ${coll}/${d.id}`);
    if (!DRY) await d.ref.delete();
  }
  if (qs.empty) console.log(`${tag} ${label}: 無符合 doc`);
}

async function delAuth(uid, label) {
  try {
    await auth.getUser(uid);
    console.log(`${tag} del auth: ${label} (${uid})`);
    if (!DRY) await auth.deleteUser(uid);
  } catch (e) {
    if (e.code === 'auth/user-not-found') console.log(`${tag} auth skip (不存在): ${label}`);
    else throw e;
  }
}

(async () => {
  console.log(`\n== R3 模擬器實測殘留清理 ${tag} ==\n`);

  console.log('-- 1) 復原封存的種子任務 --');
  for (const id of REVIVE_TASKS) await reviveTask(id);

  console.log('\n-- 2) 刪孤兒 taskSubmission --');
  await delDoc(`taskSubmissions/${ORPHAN_SUB}`);

  console.log('\n-- 3) 刪 dev-kid4 測試小孩 --');
  await delWhere('familyMemberships', 'userId', KID4_UID, 'kid4 membership');
  await delDoc(`users/${KID4_UID}`);
  await delWhere('pointWallets', 'childId', KID4_UID, 'kid4 wallet');
  await delAuth(KID4_UID, 'dev-kid4@mfk.test');

  console.log('\n-- 4) 刪 TestFamily3 測試家庭 --');
  await delWhere('familyMemberships', 'familyId', TESTFAM3, 'TF3 membership');
  await delWhere('tasks', 'familyId', TESTFAM3, 'TF3 task');
  await delWhere('rewards', 'familyId', TESTFAM3, 'TF3 reward');
  await delWhere('pointWallets', 'familyId', TESTFAM3, 'TF3 wallet');
  await delDoc(`families/${TESTFAM3}`);
  await delDoc(`users/${PARENT3_UID}`);
  await delAuth(PARENT3_UID, 'dev-parent3@mfk.test');

  console.log('\n-- 5) 刪殘留邀請 doc --');
  for (const id of DEAD_INVITES) await delDoc(`familyInvites/${id}`);

  console.log(`\n== 完成 ${tag} ==`);
  if (DRY) console.log('這是預覽。確認無誤後帶 DRY_RUN=0 實刪。');
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.code || '', e.message); process.exit(1); });
