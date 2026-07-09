/**
 * 核心迴圈 E2E 實測（家長 ↔ 小孩全流程）
 *
 * 以 firebase web SDK 模擬兩個真實 client（家長/小孩，各自帶 auth token、受 firestore.rules 約束），
 * callable 與 Firestore trigger 都跑在 functions emulator 裡 —— 端到端重演 App 的實際操作。
 * 所有寫入 shape 一比一取自畫面程式碼（tasks.tsx / review.tsx / reward/[id].tsx / order/[id].tsx…）。
 *
 * 除核心迴圈外，額外覆蓋本輪後端修復的端到端驗證：
 *   - R1（PR8 收割）：訂單扣款快照 balanceBeforeSnapshot/balanceAfterSnapshot 由 CF 寫入、
 *     client 不可預埋/竄改（rules 擋）；被拒訂單不殘留快照。
 *   - R2-02：acceptFamilyInvite 不覆寫既有身分——家長接受 child 邀請擋 ALREADY_PARENT、
 *     重複接受第二張邀請不歸零錢包。
 *   - R2-03：扣款 trigger 交易內重讀訂單，非 pending 不扣（防扣款-取消競態點數遺失）。
 *   - R2-13：grantPoints 回傳實際變動量 delta（clamp 時 |delta| < |amount|；冪等重放回 null）。
 *
 * 跑法（從專案根目錄；會先 build functions）：
 *   npm --prefix functions run build && \
 *   firebase emulators:exec --only firestore,auth,functions --project mission-for-kids \
 *     'node functions/scripts/core-loop-e2e.cjs'
 *
 * 注意：emulator 不驗複合索引（索引覆蓋另以靜態比對檢查）。
 */

// 安全閘：必須在 emulator 環境內執行（emulators:exec 會自動注入這兩個環境變數）。
// 沒有就直接拒跑，杜絕任何誤連 prod 的可能。
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('拒絕執行：未偵測到 FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST。');
  console.error('請用 firebase emulators:exec 跑本腳本（見檔頭跑法），避免誤連 production。');
  process.exit(2);
}

const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc,
  collection, getDocs, addDoc, query, where, orderBy, limit,
  writeBatch, serverTimestamp, increment, Timestamp,
} = require('firebase/firestore');
const {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut,
} = require('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');

const PROJECT_ID = 'mission-for-kids';
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FN_HOST = '127.0.0.1';
const FN_PORT = 5001;

admin.initializeApp({ projectId: PROJECT_ID });
const adb = admin.firestore();

// ---- 結果收集 ----
const results = [];
let failures = 0;
function pass(name, detail = '') { results.push({ name, ok: true, detail }); }
function fail(name, detail = '') { results.push({ name, ok: false, detail }); failures++; }
async function step(name, fn) {
  try { await fn(); pass(name); }
  catch (e) { fail(name, String((e && e.message) || e)); }
}
async function expectDenied(name, fn) {
  try { await fn(); fail(name, '應被拒但成功了'); }
  catch (e) {
    if (String(e && e.code).includes('permission-denied')) pass(name);
    else fail(name, `錯誤碼非 permission-denied：${e && e.code} ${e && e.message}`);
  }
}
// 等 trigger 生效
async function waitFor(name, checkFn, timeoutMs = 20000) {
  const t0 = Date.now();
  for (;;) {
    const ok = await checkFn().catch(() => false);
    if (ok) { pass(name); return; }
    if (Date.now() - t0 > timeoutMs) { fail(name, `等了 ${timeoutMs}ms 未達成`); return; }
    await new Promise((r) => setTimeout(r, 500));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 兩個 client（家長/小孩各自獨立 app instance）----
function makeClient(label) {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo' }, label);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST.split(':')[0], Number(FS_HOST.split(':')[1]));
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const fns = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(fns, FN_HOST, FN_PORT);
  return { app, db, auth, fns };
}

async function main() {
  const P = makeClient('parent');
  const C = makeClient('child');
  const G = makeClient('guest'); // 未登入訪客（邀請 pre-auth 讀取用）
  connectFirestoreEmulator(G.db, FS_HOST.split(':')[0], Number(FS_HOST.split(':')[1]));

  // email／冪等鍵加時間戳後綴：常駐 emulator 重跑不會撞 email-already-in-use、
  // 也不會被 grantPoints 當上一輪的冪等重放（server 端 tx doc id = parent_grant_${key}，全域）
  const runTag = Date.now();
  const dadEmail = `e2e-dad-${runTag}@mfk.test`;
  const kidEmail = `e2e-kid-${runTag}@mfk.test`;
  const idemKey1 = `e2e-key-1-${runTag}`;
  const idemKey2 = `e2e-key-2-${runTag}`;
  const idemKey3 = `e2e-key-3-${runTag}`;
  let dadUid, kidUid, familyId, inviteId, childId;
  let taskId, instanceId, itemId, item2Id, orderId, order2Id, order3Id;

  // ========== 1. 家長註冊 + bootstrap ==========
  await step('1.1 家長建 Auth 帳號', async () => {
    const cred = await createUserWithEmailAndPassword(P.auth, dadEmail, 'e2e-pass-123!');
    dadUid = cred.user.uid;
  });
  await step('1.2 bootstrapParentAccount（建 user + family + membership）', async () => {
    const fn = httpsCallable(P.fns, 'bootstrapParentAccount');
    const res = await fn({ displayName: 'E2E爸爸', familyName: 'E2E家' });
    familyId = res.data.familyId;
    if (!familyId) throw new Error('沒回 familyId');
  });
  await step('1.3 家長讀自己 membership（家頁查詢）', async () => {
    const snap = await getDocs(query(collection(P.db, 'familyMemberships'),
      where('userId', '==', dadUid), where('status', '==', 'active'), limit(1)));
    if (snap.empty) throw new Error('查不到 membership');
    if (snap.docs[0].data().familyId !== familyId) throw new Error('familyId 不符');
  });
  await step('1.4 家長讀 family doc', async () => {
    const snap = await getDoc(doc(P.db, 'families', familyId));
    if (!snap.exists()) throw new Error('family 不存在');
  });

  // ========== 2. 邀請小孩 ==========
  await step('2.1 createFamilyInvite（寄信失敗容忍）', async () => {
    const fn = httpsCallable(P.fns, 'createFamilyInvite');
    const res = await fn({ familyId, email: kidEmail, childName: '小安' });
    inviteId = res.data.inviteId;
    if (!inviteId) throw new Error('沒回 inviteId');
  });
  await step('2.2 未登入訪客讀 pending 邀請（接受畫面 pre-auth）', async () => {
    const snap = await getDoc(doc(G.db, 'familyInvites', inviteId));
    if (!snap.exists()) throw new Error('讀不到邀請');
    if (snap.data().email !== kidEmail) throw new Error('email 不符');
  });
  await step('2.3 小孩建 Auth 帳號（受邀 email）', async () => {
    const cred = await createUserWithEmailAndPassword(C.auth, kidEmail, 'e2e-pass-456!');
    kidUid = cred.user.uid;
  });
  await step('2.4 acceptFamilyInvite', async () => {
    const fn = httpsCallable(C.fns, 'acceptFamilyInvite');
    const res = await fn({ inviteId });
    childId = res.data.childId;
    if (res.data.familyId !== familyId) throw new Error('familyId 不符');
  });
  await step('2.5 小孩錢包已建立 balance=0（小孩自己讀）', async () => {
    const snap = await getDoc(doc(C.db, 'pointWallets', `${familyId}_${childId}`));
    if (!snap.exists()) throw new Error('錢包不存在');
    if (snap.data().balance !== 0) throw new Error(`初始餘額 ${snap.data().balance} != 0`);
  });
  await step('2.6 已接受的邀請未登入不可再讀（A16）', async () => {
    const snap = await getDoc(doc(G.db, 'familyInvites', inviteId)).catch((e) => e);
    if (snap && snap.code && String(snap.code).includes('permission-denied')) return;
    throw new Error('已接受邀請仍可被讀取');
  });

  // ========== 3. 家長建任務（mirror tasks.tsx）==========
  await step('3.1 家長建 task + instance', async () => {
    const now = Timestamp.now();
    const dueDate = Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);
    const gracePeriodEnd = Timestamp.fromMillis(Date.now() + 3 * 24 * 3600 * 1000);
    const taskRef = await addDoc(collection(P.db, 'tasks'), {
      familyId, title: '收玩具', points: 100, frequency: 'once',
      startDate: now, dueDate, graceDays: 2, reviewMode: 'semi_auto',
      assigneeType: 'individual', assigneeUserId: kidUid,
      status: 'active', createdBy: dadUid, createdAt: now,
    });
    taskId = taskRef.id;
    const instRef = await addDoc(collection(P.db, 'taskInstances'), {
      taskId, userId: kidUid, childId, familyId,
      periodStart: now, periodEnd: dueDate, gracePeriodEnd,
      status: 'pending', submissionCount: 0,
      reviewedBy: null, reviewedAt: null, pointsAwarded: null,
    });
    instanceId = instRef.id;
  });
  await step('3.2 小孩任務列表查詢（child tasks.tsx shape）', async () => {
    const snap = await getDocs(query(collection(C.db, 'taskInstances'),
      where('childId', '==', childId), where('familyId', '==', familyId),
      where('status', 'in', ['pending', 'submitted', 'approved', 'rejected'])));
    if (snap.size !== 1) throw new Error(`預期 1 筆，拿到 ${snap.size}`);
  });

  // ========== 4. 小孩提交（mirror task/[id].tsx batch）==========
  let submissionId;
  async function childSubmit(noteText) {
    const subRef = doc(collection(C.db, 'taskSubmissions'));
    const batch = writeBatch(C.db);
    batch.set(subRef, {
      taskInstanceId: instanceId, familyId, submittedBy: kidUid,
      photoUrls: [], childNote: noteText, aiResult: null, aiConfidence: null,
      submittedAt: serverTimestamp(),
    });
    batch.update(doc(C.db, 'taskInstances', instanceId), {
      status: 'submitted', submissionCount: increment(1), submittedAt: serverTimestamp(),
    });
    await batch.commit();
    return subRef.id;
  }
  await step('4.1 小孩提交任務（batch：submission + instance）', async () => {
    submissionId = await childSubmit('我收好了');
  });
  await step('4.2 analyzePhoto 回寫 AI 結果（emulator mock）', async () => {
    const fn = httpsCallable(C.fns, 'analyzePhoto');
    const res = await fn({ photoUrl: 'http://x/y.jpg', taskDescription: '收玩具', submissionId });
    if (!res.data.messageZh) throw new Error('沒回 messageZh');
    const sub = await adb.collection('taskSubmissions').doc(submissionId).get();
    if (sub.data().aiResult !== 'pass') throw new Error(`aiResult=${sub.data().aiResult}`);
  });

  // ========== 5. 家長審核列表 + 核准（mirror review.tsx）==========
  await step('5.1 家長審核列表查詢（instances + 最新 submission）', async () => {
    const snap = await getDocs(query(collection(P.db, 'taskInstances'),
      where('familyId', '==', familyId), where('status', '==', 'submitted')));
    if (snap.size !== 1) throw new Error(`預期 1 筆待審，拿到 ${snap.size}`);
    const subSnap = await getDocs(query(collection(P.db, 'taskSubmissions'),
      where('familyId', '==', familyId), where('taskInstanceId', '==', instanceId),
      orderBy('submittedAt', 'desc'), limit(1)));
    if (subSnap.empty) throw new Error('查不到 submission');
  });
  await step('5.2 家長核准（approved + reviewedBy）', async () => {
    await updateDoc(doc(P.db, 'taskInstances', instanceId), {
      status: 'approved', reviewedBy: dadUid, reviewedAt: serverTimestamp(),
    });
  });
  await waitFor('5.3 trigger 發點：錢包 0 → 100', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    return w.exists && w.data().balance === 100;
  });
  await waitFor('5.4 instance.pointsAwarded=100 + 確定性帳本 tx', async () => {
    const i = await adb.collection('taskInstances').doc(instanceId).get();
    const t = await adb.collection('pointTransactions').doc(`task_completion_${instanceId}`).get();
    return i.data().pointsAwarded === 100 && t.exists && t.data().delta === 100
      && t.data().sourceType === 'task_completion';
  });

  // ========== 6. 獎勵：建品項 → 小孩下單 → 扣點 ==========
  await step('6.1 家長建獎勵品項（50 點）', async () => {
    const ref = await addDoc(collection(P.db, 'rewardItems'), {
      familyId, description: null, imageUrl: null, status: 'active',
      createdBy: dadUid, createdAt: serverTimestamp(),
      title: '冰淇淋', pointCost: 50, itemType: 'physical', emoji: '🍦',
    });
    itemId = ref.id;
  });
  await step('6.2 小孩下單（mirror reward/[id].tsx）', async () => {
    const ref = await addDoc(collection(C.db, 'rewardOrders'), {
      familyId, itemId, userId: kidUid, childId,
      pointCostSnapshot: 50, status: 'pending',
      cancelledAt: null, approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null, createdAt: serverTimestamp(),
    });
    orderId = ref.id;
  });
  await waitFor('6.3 trigger 扣點 100 → 50，且 CF 寫回扣款前後餘額快照（R1）', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    const o = await adb.collection('rewardOrders').doc(orderId).get();
    return w.data().balance === 50
      && o.data().pointCostSnapshot === 50
      && o.data().balanceBeforeSnapshot === 100
      && o.data().balanceAfterSnapshot === 50;
  });
  await step('6.4 家長同意訂單（approved）', async () => {
    await updateDoc(doc(P.db, 'rewardOrders', orderId), {
      status: 'approved', approvedAt: serverTimestamp(),
    });
  });
  await step('6.5 家長交付（delivered + autoCompleteAt）', async () => {
    const now = new Date();
    await updateDoc(doc(P.db, 'rewardOrders', orderId), {
      status: 'delivered',
      deliveredAt: Timestamp.fromDate(now),
      autoCompleteAt: Timestamp.fromDate(new Date(now.getTime() + 72 * 3600 * 1000)),
    });
  });
  await step('6.6 小孩確認收到（delivered → completed）', async () => {
    await updateDoc(doc(C.db, 'rewardOrders', orderId), {
      status: 'completed', completedAt: serverTimestamp(),
    });
  });
  await step('6.7 已完成訂單不再退款（守衛）', async () => {
    // 家長把 completed 改 rejected（角色上可，但退款 CF 必須跳過）
    await updateDoc(doc(P.db, 'rewardOrders', orderId), { status: 'rejected' });
    await sleep(4000);
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 50) throw new Error(`餘額 ${w.data().balance}，退款守衛失效`);
  });

  // ========== 7. 取消 → 退款 ==========
  await step('7.1 小孩再下一單（pending）', async () => {
    const ref = await addDoc(collection(C.db, 'rewardOrders'), {
      familyId, itemId, userId: kidUid, childId,
      pointCostSnapshot: 50, status: 'pending',
      cancelledAt: null, approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null, createdAt: serverTimestamp(),
    });
    order2Id = ref.id;
  });
  await waitFor('7.2 扣點 50 → 0，快照 before=50 / after=0（R1）', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    const o = await adb.collection('rewardOrders').doc(order2Id).get();
    return w.data().balance === 0
      && o.data().balanceBeforeSnapshot === 50
      && o.data().balanceAfterSnapshot === 0;
  });
  await step('7.3 小孩取消（pending → cancelled）', async () => {
    await updateDoc(doc(C.db, 'rewardOrders', order2Id), {
      status: 'cancelled', cancelledAt: serverTimestamp(),
    });
  });
  await waitFor('7.4 退款：0 → 50', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    return w.data().balance === 50;
  });

  // ========== 8. 金額權威化（A2 動態證明）+ 快照防竄改（R1）==========
  await step('8.1 家長建貴重品項（1000 點）', async () => {
    const ref = await addDoc(collection(P.db, 'rewardItems'), {
      familyId, description: null, imageUrl: null, status: 'active',
      createdBy: dadUid, createdAt: serverTimestamp(),
      title: 'Switch', pointCost: 1000, itemType: 'physical', emoji: '🎮',
    });
    item2Id = ref.id;
  });
  await step('8.2 小孩竄改 snapshot=1 下單貴重品項', async () => {
    const ref = await addDoc(collection(C.db, 'rewardOrders'), {
      familyId, itemId: item2Id, userId: kidUid, childId,
      pointCostSnapshot: 1, status: 'pending',
      cancelledAt: null, approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null, createdAt: serverTimestamp(),
    });
    order3Id = ref.id;
  });
  await waitFor('8.3 CF 以權威價 1000 判餘額不足 → rejected、不扣點、不殘留快照', async () => {
    const o = await adb.collection('rewardOrders').doc(order3Id).get();
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    return o.data().status === 'rejected' && w.data().balance === 50
      && o.data().balanceBeforeSnapshot === undefined
      && o.data().balanceAfterSnapshot === undefined;
  });
  await expectDenied('8.4 小孩下單時預埋 balanceBeforeSnapshot 被 rules 擋（R1）', () =>
    addDoc(collection(C.db, 'rewardOrders'), {
      familyId, itemId, userId: kidUid, childId,
      pointCostSnapshot: 50, status: 'pending',
      balanceBeforeSnapshot: 99999, balanceAfterSnapshot: 99999,
      cancelledAt: null, approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null, createdAt: serverTimestamp(),
    }));

  // ========== 9. grantPoints（冪等 + clamp + 回傳 delta，R2-13）==========
  await step('9.1 grantPoints +30（帶冪等鍵）→ 回傳 delta=30', async () => {
    const fn = httpsCallable(P.fns, 'grantPoints');
    const res = await fn({ childUserId: kidUid, familyId, amount: 30, reason: 'E2E', idempotencyKey: idemKey1 });
    if (res.data.delta !== 30) throw new Error(`delta=${res.data.delta} != 30`);
  });
  await waitFor('9.2 錢包 50 → 80', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    return w.data().balance === 80;
  });
  await step('9.3 同冪等鍵重送不重複入帳（重放回 delta=null）', async () => {
    const fn = httpsCallable(P.fns, 'grantPoints');
    const res = await fn({ childUserId: kidUid, familyId, amount: 30, reason: 'E2E', idempotencyKey: idemKey1 });
    if (res.data.delta !== null) throw new Error(`重放 delta=${res.data.delta} != null`);
    await sleep(1500);
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 80) throw new Error(`餘額 ${w.data().balance} != 80`);
  });
  await step('9.4 扣點 clamp 到 0（-1000）→ 回傳實際變動 delta=-80（R2-13）', async () => {
    const fn = httpsCallable(P.fns, 'grantPoints');
    const res = await fn({ childUserId: kidUid, familyId, amount: -1000, reason: 'E2E', idempotencyKey: idemKey2 });
    if (res.data.delta !== -80) throw new Error(`delta=${res.data.delta} != -80`);
    await sleep(1500);
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 0) throw new Error(`餘額 ${w.data().balance} != 0`);
  });

  // ========== 10. 退回 → 重試 循環 ==========
  let instance2Id;
  await step('10.1 家長建第二個任務 instance（20 點）', async () => {
    const now = Timestamp.now();
    const dueDate = Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);
    const taskRef = await addDoc(collection(P.db, 'tasks'), {
      familyId, title: '刷牙', points: 20, frequency: 'daily',
      startDate: now, dueDate, graceDays: 2, reviewMode: 'manual',
      assigneeType: 'individual', assigneeUserId: kidUid,
      status: 'active', createdBy: dadUid, createdAt: now,
    });
    const instRef = await addDoc(collection(P.db, 'taskInstances'), {
      taskId: taskRef.id, userId: kidUid, childId, familyId,
      periodStart: now, periodEnd: dueDate, gracePeriodEnd: dueDate,
      status: 'pending', submissionCount: 0,
      reviewedBy: null, reviewedAt: null, pointsAwarded: null,
    });
    instance2Id = instRef.id;
  });
  await step('10.2 小孩提交 → 家長退回（rejected + rejectNote）', async () => {
    const subRef = doc(collection(C.db, 'taskSubmissions'));
    const batch = writeBatch(C.db);
    batch.set(subRef, {
      taskInstanceId: instance2Id, familyId, submittedBy: kidUid,
      photoUrls: [], childNote: '刷了', aiResult: null, aiConfidence: null,
      submittedAt: serverTimestamp(),
    });
    batch.update(doc(C.db, 'taskInstances', instance2Id), {
      status: 'submitted', submissionCount: increment(1), submittedAt: serverTimestamp(),
    });
    await batch.commit();
    await updateDoc(doc(P.db, 'taskInstances', instance2Id), {
      status: 'rejected', reviewedBy: dadUid, reviewedAt: serverTimestamp(), parentNote: '再刷一次',
    });
    await updateDoc(doc(P.db, 'taskSubmissions', subRef.id), { rejectNote: '再刷一次' });
  });
  await step('10.3 被退回不發點', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 0) throw new Error(`餘額 ${w.data().balance} != 0`);
  });
  await step('10.4 小孩重試（rejected 狀態下直接再提交）', async () => {
    const subRef = doc(collection(C.db, 'taskSubmissions'));
    const batch = writeBatch(C.db);
    batch.set(subRef, {
      taskInstanceId: instance2Id, familyId, submittedBy: kidUid,
      photoUrls: [], childNote: '真的刷了', aiResult: null, aiConfidence: null,
      submittedAt: serverTimestamp(),
    });
    batch.update(doc(C.db, 'taskInstances', instance2Id), {
      status: 'submitted', submissionCount: increment(1), submittedAt: serverTimestamp(),
    });
    await batch.commit();
  });
  await step('10.5 家長核准 → 發 20 點', async () => {
    await updateDoc(doc(P.db, 'taskInstances', instance2Id), {
      status: 'approved', reviewedBy: dadUid, reviewedAt: serverTimestamp(),
    });
  });
  await waitFor('10.6 錢包 0 → 20', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    return w.data().balance === 20;
  });

  // ========== 11. 隔離抽查（雙向）==========
  await expectDenied('11.1 小孩不能核准任務', () =>
    updateDoc(doc(C.db, 'taskInstances', instance2Id), { status: 'approved' }));
  await expectDenied('11.2 小孩不能建任務', () =>
    addDoc(collection(C.db, 'tasks'), { familyId, title: 'x', points: 9999, status: 'active' }));
  await expectDenied('11.3 小孩不能改自己 membership 的 role', () =>
    updateDoc(doc(C.db, 'familyMemberships', `${kidUid}_${familyId}`), { role: 'parent' }));
  await step('11.4 家長讀小孩錢包（家頁顯示）', async () => {
    const snap = await getDoc(doc(P.db, 'pointWallets', `${familyId}_${childId}`));
    if (!snap.exists()) throw new Error('讀不到');
  });
  await step('11.5 小孩讀家庭成員列表（暱稱顯示用）', async () => {
    const snap = await getDocs(query(collection(C.db, 'familyMemberships'),
      where('familyId', '==', familyId), where('status', '==', 'active')));
    if (snap.size !== 2) throw new Error(`預期 2 名成員，拿到 ${snap.size}`);
  });

  // ========== 12. R2-02：重複接受第二張同 email 邀請不歸零錢包 ==========
  let invite2Id;
  await step('12.1 家長對同一小孩 email 再發一張邀請', async () => {
    const fn = httpsCallable(P.fns, 'createFamilyInvite');
    const res = await fn({ familyId, email: kidEmail, childName: '小安' });
    invite2Id = res.data.inviteId;
  });
  await step('12.2 小孩接受第二張邀請（已是成員、錢包有 20 點）', async () => {
    const fn = httpsCallable(C.fns, 'acceptFamilyInvite');
    const res = await fn({ inviteId: invite2Id });
    if (res.data.familyId !== familyId) throw new Error('familyId 不符');
  });
  await step('12.3 錢包餘額仍為 20（未被 acceptFamilyInvite 覆寫歸零）', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 20) throw new Error(`餘額 ${w.data().balance} != 20（回歸：錢包被歸零）`);
  });

  // ========== 13. bootstrapParentAccount 冪等（重複註冊不重建家庭）==========
  await step('13.1 家長重呼叫 bootstrapParentAccount → 回傳同一 familyId', async () => {
    const fn = httpsCallable(P.fns, 'bootstrapParentAccount');
    const res = await fn({ displayName: 'E2E爸爸', familyName: '不該建新的家' });
    if (res.data.familyId !== familyId) throw new Error(`回了不同 familyId：${res.data.familyId}`);
  });
  await step('13.2 家長家庭數仍為 1（沒生出重複家庭）', async () => {
    const snap = await adb.collection('familyMemberships')
      .where('userId', '==', dadUid).where('role', '==', 'parent').where('status', '==', 'active').get();
    if (snap.size !== 1) throw new Error(`家長 active parent membership 有 ${snap.size} 筆`);
  });

  // ========== 14. R2-02：家長接受 child 邀請 → ALREADY_PARENT，身分不被覆寫 ==========
  let invite3Id;
  await step('14.1 家長對自己的 email 發一張 child 邀請', async () => {
    const fn = httpsCallable(P.fns, 'createFamilyInvite');
    const res = await fn({ familyId, email: dadEmail, childName: '不該存在的小孩' });
    invite3Id = res.data.inviteId;
    if (!invite3Id) throw new Error('沒回 inviteId');
  });
  await step('14.2 家長接受 child 邀請被擋（failed-precondition ALREADY_PARENT）', async () => {
    const fn = httpsCallable(P.fns, 'acceptFamilyInvite');
    try {
      await fn({ inviteId: invite3Id });
      throw new Error('應被拒但成功了');
    } catch (e) {
      const code = String(e && e.code);
      const msg = String(e && e.message);
      if (!code.includes('failed-precondition') || !msg.includes('ALREADY_PARENT')) {
        throw new Error(`錯誤不符：code=${code} msg=${msg}`);
      }
    }
  });
  await step('14.3 家長身分未被覆寫（user/membership 原樣、邀請仍 pending、無家長錢包）', async () => {
    const u = await adb.collection('users').doc(dadUid).get();
    if (u.data().roleType !== 'parent') throw new Error(`user.roleType=${u.data().roleType}（被覆寫成 child）`);
    const m = await adb.collection('familyMemberships').doc(`${dadUid}_${familyId}`).get();
    if (m.data().role !== 'parent') throw new Error(`membership.role=${m.data().role}`);
    const inv = await adb.collection('familyInvites').doc(invite3Id).get();
    if (inv.data().status !== 'pending') throw new Error(`邀請 status=${inv.data().status}（交易未回滾）`);
    const w = await adb.collection('pointWallets').doc(`${familyId}_${dadUid}`).get();
    if (w.exists) throw new Error('多出家長錢包（不該建立）');
  });

  // ========== 15. R2-03：扣款-取消競態不遺失點數（trigger 交易內重讀對帳）==========
  await step('15.1 grantPoints +100 備妥測試餘額（20 → 120）', async () => {
    const fn = httpsCallable(P.fns, 'grantPoints');
    const res = await fn({ childUserId: kidUid, familyId, amount: 100, reason: 'E2E race', idempotencyKey: idemKey3 });
    if (res.data.delta !== 100) throw new Error(`delta=${res.data.delta} != 100`);
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 120) throw new Error(`餘額 ${w.data().balance} != 120`);
  });
  await step('15.2 取消先落地的訂單（扣款 trigger 重讀非 pending → 不扣、不留帳）', async () => {
    // 用 admin 佈置「出生即 cancelled」的訂單（與 rules-proof.cjs 同慣例：admin 佈置情境）。
    // client 端做不到原子建單+取消——rules 對 batch 內同 doc 的 create 以最終值評估，
    // status 已是 cancelled 會被 create 規則擋下；取消必然是第二個 commit，競態窗口真實存在。
    // 這裡確定性重演「取消先落地、扣款 trigger 後到」：R2-03 修復前會照扣且無人退款（點數永久遺失）。
    const raceRef = adb.collection('rewardOrders').doc();
    await raceRef.set({
      familyId, itemId, userId: kidUid, childId,
      pointCostSnapshot: 50, status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await sleep(5000); // 等 trigger 跑完
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 120) throw new Error(`餘額 ${w.data().balance} != 120（競態扣款未被守衛擋下）`);
    const d = await adb.collection('pointTransactions').doc(`reward_order_${raceRef.id}`).get();
    const r = await adb.collection('pointTransactions').doc(`reward_refund_${raceRef.id}`).get();
    if (d.exists || r.exists) throw new Error(`不該有帳：扣款=${d.exists} 退款=${r.exists}`);
  });
  await step('15.3 下單後立刻取消（真競態）→ 對帳不變式：餘額不變、扣退成對', async () => {
    const ref = await addDoc(collection(C.db, 'rewardOrders'), {
      familyId, itemId, userId: kidUid, childId,
      pointCostSnapshot: 50, status: 'pending',
      cancelledAt: null, approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null, createdAt: serverTimestamp(),
    });
    await updateDoc(doc(C.db, 'rewardOrders', ref.id), {
      status: 'cancelled', cancelledAt: serverTimestamp(),
    });
    await sleep(6000); // 等兩個 trigger 都收斂
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    const d = await adb.collection('pointTransactions').doc(`reward_order_${ref.id}`).get();
    const r = await adb.collection('pointTransactions').doc(`reward_refund_${ref.id}`).get();
    if (w.data().balance !== 120) throw new Error(`餘額 ${w.data().balance} != 120（點數遺失）`);
    if (d.exists !== r.exists) throw new Error(`帳不成對：扣款=${d.exists} 退款=${r.exists}`);
  });

  // ---- 報告 ----
  console.log('\n================ 核心迴圈 E2E 實測結果 ================');
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  console.log('======================================================');
  console.log(failures === 0 ? `結果：${results.length}/${results.length} 全部通過 ✅` : `結果：${failures} 個失敗 ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('E2E crashed:', e); process.exit(2); });
