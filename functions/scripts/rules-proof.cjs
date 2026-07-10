/**
 * Firestore 安全規則強制力證明（feat/security-hardening-demo）
 *
 * 用 firebase-admin 佈置情境（繞過規則），再用 firebase web SDK 以「小孩」身分
 * 對 emulator（會強制 firestore.rules）發動審查報告裡的攻擊，斷言全被擋下，
 * 同時確認正常流程仍放行。
 *
 * 跑法（從專案根目錄）：
 *   firebase emulators:exec --only firestore,auth 'node functions/scripts/rules-proof.cjs'
 * emulator 會載入根目錄的 firestore.rules（本分支的加固版）。
 */
const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const {
  getFirestore, connectFirestoreEmulator,
  doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, query, where,
} = require('firebase/firestore');
const { getAuth, connectAuthEmulator, signInWithCustomToken } = require('firebase/auth');

const PROJECT_ID = 'mission-for-kids';
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

admin.initializeApp({ projectId: PROJECT_ID });
const adb = admin.firestore();

// ---- 結果收集 ----
const results = [];
function record(name, expected, got, detail) {
  const pass = expected === got;
  results.push({ name, expected, got, pass, detail });
}
async function expectDenied(name, fn) {
  try {
    await fn();
    record(name, 'DENIED', 'ALLOWED', '攻擊成功了（不應該）');
  } catch (e) {
    const denied = String(e && e.code).includes('permission-denied');
    record(name, 'DENIED', denied ? 'DENIED' : `ERR:${e && e.code}`, denied ? '' : String(e && e.message));
  }
}
async function expectAllowed(name, fn) {
  try {
    await fn();
    record(name, 'ALLOWED', 'ALLOWED', '');
  } catch (e) {
    record(name, 'ALLOWED', `DENIED:${e && e.code}`, String(e && e.message));
  }
}

async function seed() {
  // 兩個家庭：F（小孩屬於）、G（別人家庭，用來測跨家庭讀取）
  const KID = 'kid_uid', DAD = 'dad_uid', OUTSIDER = 'out_uid';
  await admin.auth().createUser({ uid: KID, email: 'kid@demo.test', password: 'x' }).catch(() => {});
  await admin.auth().createUser({ uid: DAD, email: 'dad@demo.test', password: 'x' }).catch(() => {});

  await adb.collection('families').doc('F').set({ displayName: 'F家', createdBy: DAD, defaultGraceDays: 2 });
  await adb.collection('families').doc('G').set({ displayName: 'G家', createdBy: OUTSIDER, defaultGraceDays: 2 });
  await adb.collection('familyMemberships').doc(`${DAD}_F`).set({ familyId: 'F', userId: DAD, role: 'parent', status: 'active' });
  await adb.collection('familyMemberships').doc(`${KID}_F`).set({ familyId: 'F', userId: KID, role: 'child', status: 'active', childId: KID });
  await adb.collection('familyMemberships').doc(`${OUTSIDER}_G`).set({ familyId: 'G', userId: OUTSIDER, role: 'parent', status: 'active' });
  // R3 審查修正用：F 家一個已被移除的成員（測「翻回 active」攻擊）
  await adb.collection('familyMemberships').doc('kid2_uid_F').set({ familyId: 'F', userId: 'kid2_uid', role: 'child', status: 'removed', childId: 'kid2_uid' });

  await adb.collection('tasks').doc('T').set({ familyId: 'F', title: '收玩具', points: 100, status: 'active', createdBy: DAD });
  await adb.collection('taskInstances').doc('I').set({
    taskId: 'T', userId: KID, childId: KID, familyId: 'F', status: 'pending',
    submissionCount: 0, reviewedBy: null, pointsAwarded: null,
  });
  await adb.collection('rewardItems').doc('R').set({ familyId: 'F', title: '玩具', pointCost: 100, status: 'active' });
  await adb.collection('pointWallets').doc('F_' + KID).set({ familyId: 'F', childId: KID, userId: KID, balance: 50 });
  await adb.collection('pointTransactions').doc('tx1').set({ walletId: 'F_' + KID, childId: KID, delta: 50, sourceType: 'parent_grant' });
  // 別人家庭 G 的兒童照片提交（跨家庭讀取測試）
  await adb.collection('taskSubmissions').doc('subG').set({ taskInstanceId: 'IG', familyId: 'G', submittedBy: OUTSIDER, photoUrls: ['secret.jpg'], childNote: 'G家小孩的私密照片' });

  const token = await admin.auth().createCustomToken(KID);
  const dadToken = await admin.auth().createCustomToken(DAD);
  return { token, dadToken };
}

async function main() {
  const { token, dadToken } = await seed();

  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo' });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST.split(':')[0], Number(FS_HOST.split(':')[1]));
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  await signInWithCustomToken(auth, token); // 以「小孩」身分登入

  // ===== 攻擊（全部應 DENIED）=====
  await expectDenied('A1 小孩自批任務 → approved', () =>
    updateDoc(doc(db, 'taskInstances', 'I'), { status: 'approved', reviewedBy: 'kid_uid' }));

  await expectDenied('A3a 小孩把自己 membership 改成 parent', () =>
    updateDoc(doc(db, 'familyMemberships', 'kid_uid_F'), { role: 'parent' }));

  await expectDenied('A3b 在別人家庭 G 建 parent membership', () =>
    setDoc(doc(db, 'familyMemberships', 'kid_uid_G'), { familyId: 'G', userId: 'kid_uid', role: 'parent', status: 'active' }));

  // R3 審查修正：client 直建 family＋自己的 parent membership（繞過 bootstrapParentAccount
  // 的 ALREADY_IN_FAMILY 守衛、自開第二個家庭）——create 已全面收回，一律 DENIED。
  await expectDenied('R3 直建 family（繞過 CF 一帳號一家庭守衛）', () =>
    setDoc(doc(db, 'families', 'H'), { displayName: 'H家', createdBy: 'kid_uid', defaultGraceDays: 2 }));
  await expectDenied('R3 直建自己的 parent membership', () =>
    setDoc(doc(db, 'familyMemberships', 'kid_uid_H'), { familyId: 'H', userId: 'kid_uid', role: 'parent', status: 'active' }));

  await expectDenied('A4 讀別人家庭 G 的兒童照片提交', () =>
    getDocs(query(collection(db, 'taskSubmissions'), where('familyId', '==', 'G'))));

  await expectDenied('A5 枚舉全部 users', () =>
    getDocs(collection(db, 'users')));

  await expectDenied('A12 讀點數帳本 pointTransactions', () =>
    getDoc(doc(db, 'pointTransactions', 'tx1')));

  // A6：小孩可建自己的訂單（pending），但不能自己核准
  let orderId = null;
  await expectAllowed('正常：小孩建自己的兌換訂單(pending)', async () => {
    const ref = await addDoc(collection(db, 'rewardOrders'), {
      familyId: 'F', itemId: 'R', userId: 'kid_uid', childId: 'kid_uid', pointCostSnapshot: 100, status: 'pending',
    });
    orderId = ref.id;
  });
  await expectDenied('A6 小孩自批兌換訂單 → approved', () =>
    updateDoc(doc(db, 'rewardOrders', orderId), { status: 'approved' }));

  // ===== 正常流程（應 ALLOWED）=====
  await expectAllowed('正常：小孩提交任務 → submitted', () =>
    updateDoc(doc(db, 'taskInstances', 'I'), { status: 'submitted', submissionCount: 1 }));
  await expectAllowed('正常：小孩讀自己家庭的任務', () =>
    getDocs(query(collection(db, 'tasks'), where('familyId', '==', 'F'), where('status', '==', 'active'))));
  await expectAllowed('正常：小孩讀自己錢包', () =>
    getDoc(doc(db, 'pointWallets', 'F_kid_uid')));

  // ===== R3-3：切換成「家長」身分——移除成員只能走 removeFamilyMember CF =====
  await signInWithCustomToken(auth, dadToken);
  await expectDenied('R3-3 家長 client 直改 membership status → removed', () =>
    updateDoc(doc(db, 'familyMemberships', 'kid_uid_F'), { status: 'removed' }));
  // R3 審查修正：status 完全不可由 client 改——把 removed 翻回 active（重造雙 active
  // membership）也要擋。reactivate 只走 acceptFamilyInvite CF（admin）。
  await expectDenied('R3 家長把 removed membership 翻回 active', () =>
    updateDoc(doc(db, 'familyMemberships', 'kid2_uid_F'), { status: 'active' }));
  await expectAllowed('正常：家長改成員暱稱/頭像（不動 status）', () =>
    updateDoc(doc(db, 'familyMemberships', 'kid_uid_F'), { nickname: '小明明', avatarEmoji: '🦊' }));

  // ===== 報告 =====
  console.log('\n================ 安全規則強制力證明 ================');
  let allPass = true;
  for (const r of results) {
    const mark = r.pass ? '✅' : '❌';
    if (!r.pass) allPass = false;
    console.log(`${mark} [${r.got.padEnd(8)}] ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  console.log('===================================================');
  console.log(allPass ? '結果：全部通過 ✅（攻擊全擋下、正常流程全放行）' : '結果：有項目未如預期 ❌');
  console.log('===================================================\n');
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error('proof crashed:', e); process.exit(2); });
