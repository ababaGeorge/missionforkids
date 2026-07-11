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
 *   - R2-CX1：firestore.rules 編碼狀態機——舊版 client（沒有交易守衛）直打 Firestore 的
 *     非法狀態流轉（cancelled→approved、pending→approved、missed→approved、竄改快照/點數欄位）
 *     一律 PERMISSION_DENIED；合法流轉（revive、syncPeriod、正常審核）不受影響（第 16 節）。
 *   - FIX-A（347d0e1）：扣款守衛收窄——家長核准搶在扣款 trigger（prod 冷啟動 2–10 秒）
 *     之前把 pending 改成 approved，trigger 仍要照扣、寫快照、寫 ledger，不放水（第 17 節）。
 *   - R3-1/R3-2（第 18 節）：一帳號一家庭——已在家庭 A 的小孩接家庭 B 邀請擋
 *     ALREADY_IN_FAMILY（且被擋後零副作用）；已有 active membership 的帳號 bootstrap
 *     擋 ALREADY_IN_FAMILY；小孩帳號 bootstrap 擋 ALREADY_CHILD。
 *   - R3-4（第 19 節）：任務封存後，舊版 client（無 submitInstanceGuarded）直寫提交
 *     轉移被 rules 後端擋；解除封存後同一提交放行（證明擋的就是 archived 這一刀）。
 *   - R3-6（第 20 節）：markMissed 走收窄 helper（updateInstanceIfStatusIn 鏡像，來源限
 *     IN_PROGRESS 三態）——approved 不被蓋掉；裸 update approved→missed 也被 rules 擋；
 *     submitted→missed（解除指派常規路徑）仍放行。
 *   - R3-3（第 21 節）：removeFamilyMember 全鏈——NOT_PARENT / MEMBER_NOT_FOUND /
 *     CANNOT_REMOVE_SELF 守衛、client 直改 status→removed 被 rules 擋（暱稱更新不受影響）、
 *     移除原子完成 membership removed＋pending 邀請 revoked、revoked 邀請不可接受/不可
 *     pre-auth 讀、被移除成員讀家庭資料被擋、同家庭重邀 reactivate 不被 R3-1 誤擋。
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
  writeBatch, serverTimestamp, increment, Timestamp, runTransaction,
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
// callable 錯誤斷言：驗 HttpsError 的 code（如 failed-precondition）＋訊息內的業務錯誤碼
async function expectCallableError(name, fn, codePart, msgPart) {
  try { await fn(); fail(name, '應被拒但成功了'); }
  catch (e) {
    const code = String(e && e.code);
    const msg = String(e && e.message);
    if (code.includes(codePart) && (!msgPart || msg.includes(msgPart))) pass(name);
    else fail(name, `錯誤不符：預期 ${codePart}/${msgPart ?? ''}，拿到 code=${code} msg=${msg}`);
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
  await expectDenied('6.7 家長把 completed 改 rejected 被 rules 擋（R2-CX1 狀態機：completed 是終態）', () =>
    updateDoc(doc(P.db, 'rewardOrders', orderId), { status: 'rejected' }));
  await step('6.8 已完成訂單即使被改成 rejected 也不退款（CF 守衛縱深，admin 繞過 rules 重演）', async () => {
    // R2-CX1 前這步用家長 client 寫（當時 rules 允許任意流轉）；現在 rules 已擋，
    // 改用 admin 繞過 rules 直接竄改，證明退款 CF 的「已交付/完成不退款」守衛仍是第二道防線。
    await adb.collection('rewardOrders').doc(orderId).update({ status: 'rejected' });
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

  // ========== 16. R2-CX1：rules 狀態機（防舊版 client / 直打 API 的非法狀態回寫）==========
  // 模擬「沒有 R2 交易守衛的舊版 App」直接對 Firestore 發動的非法狀態流轉，
  // 全部必須被 firestore.rules 的狀態機擋下（PERMISSION_DENIED）；
  // 同時實測矩陣內的合法流轉（revive / syncPeriod / 正常審核）沒被擋錯。
  // 進場餘額：120（15.3 結束時）。

  // -- 訂單：cancelled 是終態（退款已發生，改回 approved = 免費領獎）--
  await expectDenied('16.1 家長把已取消訂單改回 approved（退款已發生→免費領獎）', () =>
    updateDoc(doc(P.db, 'rewardOrders', order2Id), {
      status: 'approved', approvedAt: serverTimestamp(),
    }));

  // -- 任務 instance 狀態機 --
  let task3Id, instance3Id;
  await step('16.2 家長建第三個任務 instance（10 點，pending）', async () => {
    const now = Timestamp.now();
    const dueDate = Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);
    const taskRef = await addDoc(collection(P.db, 'tasks'), {
      familyId, title: '倒垃圾', points: 10, frequency: 'weekly',
      startDate: now, dueDate, graceDays: 2, reviewMode: 'manual',
      assigneeType: 'individual', assigneeUserId: kidUid,
      status: 'active', createdBy: dadUid, createdAt: now,
    });
    task3Id = taskRef.id;
    const instRef = await addDoc(collection(P.db, 'taskInstances'), {
      taskId: task3Id, userId: kidUid, childId, familyId,
      periodStart: now, periodEnd: dueDate, gracePeriodEnd: dueDate,
      status: 'pending', submissionCount: 0,
      reviewedBy: null, reviewedAt: null, pointsAwarded: null,
    });
    instance3Id = instRef.id;
  });
  await expectDenied('16.3 家長未提交直接核准（pending → approved 不在矩陣）', () =>
    updateDoc(doc(P.db, 'taskInstances', instance3Id), {
      status: 'approved', reviewedBy: dadUid, reviewedAt: serverTimestamp(),
    }));
  await expectDenied('16.4 家長建 instance 直接出生 approved（create 必須 pending）', () =>
    addDoc(collection(P.db, 'taskInstances'), {
      taskId: task3Id, userId: kidUid, childId, familyId,
      periodStart: Timestamp.now(), periodEnd: Timestamp.now(), gracePeriodEnd: Timestamp.now(),
      status: 'approved', submissionCount: 0,
      reviewedBy: dadUid, reviewedAt: serverTimestamp(), pointsAwarded: null,
    }));
  await step('16.5 家長標記 missed（編輯移除路徑 pending → missed，R2-08）', async () => {
    await updateDoc(doc(P.db, 'taskInstances', instance3Id), { status: 'missed' });
  });
  await expectDenied('16.6 家長把 missed 打成 approved（missed → approved 不在矩陣）', () =>
    updateDoc(doc(P.db, 'taskInstances', instance3Id), {
      status: 'approved', reviewedBy: dadUid, reviewedAt: serverTimestamp(),
    }));
  await step('16.7 家長復活 missed instance（missed → pending，R2-08 revive）', async () => {
    const now = Timestamp.now();
    const dueDate = Timestamp.fromMillis(Date.now() + 7 * 24 * 3600 * 1000);
    await updateDoc(doc(P.db, 'taskInstances', instance3Id), {
      status: 'pending', periodStart: now, periodEnd: dueDate, gracePeriodEnd: dueDate,
      submissionCount: 0, reviewedBy: null, reviewedAt: null, pointsAwarded: null,
    });
  });
  await step('16.8 家長同步期限（頻率改變 syncPeriod：status 不變只動期限）', async () => {
    const dueDate = Timestamp.fromMillis(Date.now() + 14 * 24 * 3600 * 1000);
    await updateDoc(doc(P.db, 'taskInstances', instance3Id), {
      periodEnd: dueDate, gracePeriodEnd: dueDate,
    });
  });
  await step('16.9 小孩提交第三任務（pending → submitted）', async () => {
    const subRef = doc(collection(C.db, 'taskSubmissions'));
    const batch = writeBatch(C.db);
    batch.set(subRef, {
      taskInstanceId: instance3Id, familyId, submittedBy: kidUid,
      photoUrls: [], childNote: '倒了', aiResult: null, aiConfidence: null,
      submittedAt: serverTimestamp(),
    });
    batch.update(doc(C.db, 'taskInstances', instance3Id), {
      status: 'submitted', submissionCount: increment(1), submittedAt: serverTimestamp(),
    });
    await batch.commit();
  });
  await expectDenied('16.10 小孩把 submitted 拉回 pending（撤回提交不在矩陣）', () =>
    updateDoc(doc(C.db, 'taskInstances', instance3Id), { status: 'pending' }));
  await expectDenied('16.11 家長核准時夾帶竄改 pointsAwarded（欄位白名單擋）', () =>
    updateDoc(doc(P.db, 'taskInstances', instance3Id), {
      status: 'approved', reviewedBy: dadUid, reviewedAt: serverTimestamp(),
      pointsAwarded: 99999,
    }));
  await step('16.12 攻擊未破壞正路徑：家長正常核准第三任務', async () => {
    await updateDoc(doc(P.db, 'taskInstances', instance3Id), {
      status: 'approved', reviewedBy: dadUid, reviewedAt: serverTimestamp(),
    });
  });
  await waitFor('16.13 發點 120 → 130', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    return w.data().balance === 130;
  });

  // -- 訂單：家長 update 竄改快照欄位（R1 釘法在狀態機白名單下保持）--
  let order4Id;
  await step('16.14 小孩下第四單（50 點，pending）', async () => {
    const ref = await addDoc(collection(C.db, 'rewardOrders'), {
      familyId, itemId, userId: kidUid, childId,
      pointCostSnapshot: 50, status: 'pending',
      cancelledAt: null, approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null, createdAt: serverTimestamp(),
    });
    order4Id = ref.id;
  });
  await waitFor('16.15 扣點 130 → 80', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    return w.data().balance === 80;
  });
  await expectDenied('16.16 家長核准訂單時夾帶竄改 balanceAfterSnapshot', () =>
    updateDoc(doc(P.db, 'rewardOrders', order4Id), {
      status: 'approved', approvedAt: serverTimestamp(),
      balanceAfterSnapshot: 99999,
    }));
  await expectDenied('16.17 家長不換狀態直接改 balanceBeforeSnapshot', () =>
    updateDoc(doc(P.db, 'rewardOrders', order4Id), { balanceBeforeSnapshot: 99999 }));
  await step('16.18 攻擊未破壞正路徑：家長正常核准第四單', async () => {
    await updateDoc(doc(P.db, 'rewardOrders', order4Id), {
      status: 'approved', approvedAt: serverTimestamp(),
    });
  });

  // ========== 17. FIX-A（347d0e1）：核准搶在扣款 trigger 前落地，仍照扣不放水 ==========
  // R2-03 的舊守衛「非 pending 一律跳過」在家長核准搶在扣款 trigger（prod 冷啟動 2-10 秒）
  // 之前把 pending 改成 approved 時，會讓 trigger 永久跳過扣款——形成免費領獎窗口。
  // FIX-A 收窄為只在 cancelled/rejected/doc 不存在時跳過，approved 必須照扣（重放保護
  // 由扣款 ledger 的冪等 doc 承擔，不會重複扣）。
  // 進場餘額：80（16.15 結束時）。
  let order5Id;
  await step('17.1 小孩下單（50 點）＋家長不等 trigger、立刻核准（pending → approved）', async () => {
    const ref = await addDoc(collection(C.db, 'rewardOrders'), {
      familyId, itemId, userId: kidUid, childId,
      pointCostSnapshot: 50, status: 'pending',
      cancelledAt: null, approvedAt: null, deliveredAt: null,
      completedAt: null, autoCompleteAt: null, createdAt: serverTimestamp(),
    });
    order5Id = ref.id;
    // 不 sleep、不等扣款 trigger——建單後立刻以家長身分核准，
    // 模擬「核准搶在扣款 trigger 之前落地」的免費領獎窗口（FIX-A 修復前的攻擊場景）。
    await updateDoc(doc(P.db, 'rewardOrders', order5Id), {
      status: 'approved', approvedAt: serverTimestamp(),
    });
  });
  await waitFor('17.2 trigger 仍照扣：錢包 80 → 30，快照寫入，訂單維持 approved（FIX-A）', async () => {
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    const o = await adb.collection('rewardOrders').doc(order5Id).get();
    return w.exists && o.exists
      && w.data().balance === 30
      && o.data().status === 'approved'
      && o.data().balanceBeforeSnapshot === 80
      && o.data().balanceAfterSnapshot === 30;
  });
  await step('17.3 pointTransactions 有對應扣款 ledger（冪等 doc reward_order_{orderId}）', async () => {
    const pt = await adb.collection('pointTransactions').doc(`reward_order_${order5Id}`).get();
    if (!pt.exists) throw new Error('查無扣款 ledger（FIX-A 前的守衛會在此跳過扣款，無帳可查）');
    if (pt.data().delta !== -50) throw new Error(`delta=${pt.data().delta} != -50`);
    if (pt.data().sourceType !== 'reward_order') throw new Error(`sourceType=${pt.data().sourceType}`);
  });

  // ========== 18. R3-1/R3-2：一帳號一家庭（跨家庭閘門）==========
  // R3-1：acceptFamilyInvite 交易內查「其他家庭的 active membership」→ ALREADY_IN_FAMILY。
  //       同家庭路徑不受影響（12.2 重複接受、21.12 reactivate 即為活體迴歸證明）。
  // R3-2：bootstrapParentAccount 建家庭前查任何 active membership（不分角色）。
  // 進場餘額：30（17.2 結束時）。
  const P2 = makeClient('parent2'); // 家庭 B 的家長
  const S = makeClient('stray');    // 有 membership 但無 user doc 的殘破帳號（R3-2 守衛主目標）
  const dad2Email = `e2e-dad2-${runTag}@mfk.test`;
  const strayEmail = `e2e-stray-${runTag}@mfk.test`;
  let dad2Uid, familyBId, inviteBId, strayUid;
  await step('18.1 第二家長註冊＋bootstrap 出家庭 B（無 membership 帳號的正路徑）', async () => {
    const cred = await createUserWithEmailAndPassword(P2.auth, dad2Email, 'e2e-pass-789!');
    dad2Uid = cred.user.uid;
    const fn = httpsCallable(P2.fns, 'bootstrapParentAccount');
    const res = await fn({ displayName: 'E2E二叔', familyName: 'E2E二家' });
    familyBId = res.data.familyId;
    if (!familyBId || familyBId === familyId) throw new Error(`familyBId 異常：${familyBId}`);
  });
  await step('18.2 家庭 B 對「已在家庭 A 的小孩」email 發邀請', async () => {
    const fn = httpsCallable(P2.fns, 'createFamilyInvite');
    const res = await fn({ familyId: familyBId, email: kidEmail, childName: '跨家庭小孩' });
    inviteBId = res.data.inviteId;
    if (!inviteBId) throw new Error('沒回 inviteId');
  });
  await expectCallableError('18.3 家庭 A 的小孩接受家庭 B 邀請被擋（R3-1 ALREADY_IN_FAMILY）', async () => {
    const fn = httpsCallable(C.fns, 'acceptFamilyInvite');
    await fn({ inviteId: inviteBId });
  }, 'failed-precondition', 'ALREADY_IN_FAMILY');
  await step('18.4 被擋後零副作用：B 邀請仍 pending、無 B membership/錢包、A membership 仍 active', async () => {
    const inv = await adb.collection('familyInvites').doc(inviteBId).get();
    if (inv.data().status !== 'pending') throw new Error(`B 邀請 status=${inv.data().status}（交易未回滾）`);
    const mB = await adb.collection('familyMemberships').doc(`${kidUid}_${familyBId}`).get();
    if (mB.exists) throw new Error('多出家庭 B membership');
    const wB = await adb.collection('pointWallets').doc(`${familyBId}_${kidUid}`).get();
    if (wB.exists) throw new Error('多出家庭 B 錢包');
    const mA = await adb.collection('familyMemberships').doc(`${kidUid}_${familyId}`).get();
    if (mA.data().status !== 'active') throw new Error(`A membership status=${mA.data().status}`);
  });
  await step('18.5 佈置殘破帳號：有 active membership、無 user doc（admin 佈置情境）', async () => {
    const cred = await createUserWithEmailAndPassword(S.auth, strayEmail, 'e2e-pass-000!');
    strayUid = cred.user.uid;
    await adb.collection('familyMemberships').doc(`${strayUid}_${familyBId}`).set({
      familyId: familyBId, userId: strayUid, childId: strayUid,
      role: 'child', status: 'active', invitedBy: dad2Uid,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      nickname: null, avatarEmoji: null,
    });
  });
  await expectCallableError('18.6 有 active membership 的帳號 bootstrap 被擋（R3-2 ALREADY_IN_FAMILY）', async () => {
    const fn = httpsCallable(S.fns, 'bootstrapParentAccount');
    await fn({ displayName: '不該存在的家長', familyName: '不該存在的家' });
  }, 'failed-precondition', 'ALREADY_IN_FAMILY');
  await step('18.7 被擋後零副作用：無 user doc、membership 仍只有 1 筆', async () => {
    const u = await adb.collection('users').doc(strayUid).get();
    if (u.exists) throw new Error('bootstrap 被擋卻建了 user doc');
    const mems = await adb.collection('familyMemberships').where('userId', '==', strayUid).get();
    if (mems.size !== 1) throw new Error(`membership 有 ${mems.size} 筆`);
  });
  await expectCallableError('18.8 小孩帳號 bootstrap 被擋（ALREADY_CHILD，孤兒恢復路徑不可自升家長）', async () => {
    const fn = httpsCallable(C.fns, 'bootstrapParentAccount');
    await fn({ displayName: '不該升級的小孩', familyName: '不該存在的家' });
  }, 'failed-precondition', 'ALREADY_CHILD');

  // ========== 19. R3-4c：任務封存後，舊版 client 直寫提交被 rules 後端擋 ==========
  // 新版 client 的交易守衛（submitInstanceGuarded）只保護新 App；這裡模擬「沒有守衛的
  // 舊版 client」直打 Firestore 的提交 batch，必須被 rules 的 archived 檢查擋下。
  //
  // 邊界揭露（R3 審查確認、接受不擋）：rules 的 archived 檢查只掛在 taskInstances 的
  // 提交轉移條款；taskSubmissions create 本身不查 task 是否 archived——單獨 addDoc
  // 一筆 submission 可以成功、留下孤兒 doc（無點數/審核影響：審核流讀的是 submitted
  // 的 taskInstance，而該轉移已被擋）。19.3 擋下整個 batch 靠的是 instance 轉移被拒
  // ＋batch 原子性，不是 submission create 被擋。取捨理由見 firestore.rules
  // taskSubmissions 段註解。
  let task5Id, instance5Id;
  await step('19.1 家長建第五個任務 instance（pending）', async () => {
    const now = Timestamp.now();
    const dueDate = Timestamp.fromMillis(Date.now() + 24 * 3600 * 1000);
    const taskRef = await addDoc(collection(P.db, 'tasks'), {
      familyId, title: '澆花', points: 15, frequency: 'once',
      startDate: now, dueDate, graceDays: 2, reviewMode: 'manual',
      assigneeType: 'individual', assigneeUserId: kidUid,
      status: 'active', createdBy: dadUid, createdAt: now,
    });
    task5Id = taskRef.id;
    const instRef = await addDoc(collection(P.db, 'taskInstances'), {
      taskId: task5Id, userId: kidUid, childId, familyId,
      periodStart: now, periodEnd: dueDate, gracePeriodEnd: dueDate,
      status: 'pending', submissionCount: 0,
      reviewedBy: null, reviewedAt: null, pointsAwarded: null,
    });
    instance5Id = instRef.id;
  });
  await step('19.2 家長封存任務（soft delete：status → archived）', async () => {
    await updateDoc(doc(P.db, 'tasks', task5Id), { status: 'archived' });
  });
  await expectDenied('19.3 封存後小孩直寫提交轉移被 rules 擋（R3-4c，舊版 client 無守衛也擋）', async () => {
    const subRef = doc(collection(C.db, 'taskSubmissions'));
    const batch = writeBatch(C.db);
    batch.set(subRef, {
      taskInstanceId: instance5Id, familyId, submittedBy: kidUid,
      photoUrls: [], childNote: '澆了', aiResult: null, aiConfidence: null,
      submittedAt: serverTimestamp(),
    });
    batch.update(doc(C.db, 'taskInstances', instance5Id), {
      status: 'submitted', submissionCount: increment(1), submittedAt: serverTimestamp(),
    });
    await batch.commit();
  });
  await step('19.4 batch 原子回滾：instance 仍 pending、count=0、無 submission 殘留', async () => {
    const i = await adb.collection('taskInstances').doc(instance5Id).get();
    if (i.data().status !== 'pending') throw new Error(`status=${i.data().status}`);
    if (i.data().submissionCount !== 0) throw new Error(`submissionCount=${i.data().submissionCount}`);
    const subs = await adb.collection('taskSubmissions')
      .where('taskInstanceId', '==', instance5Id).get();
    if (!subs.empty) throw new Error(`殘留 ${subs.size} 筆 submission`);
  });
  await step('19.5 解除封存後同一提交放行（證明 19.3 擋的就是 archived 這一刀）', async () => {
    await updateDoc(doc(P.db, 'tasks', task5Id), { status: 'active' });
    const subRef = doc(collection(C.db, 'taskSubmissions'));
    const batch = writeBatch(C.db);
    batch.set(subRef, {
      taskInstanceId: instance5Id, familyId, submittedBy: kidUid,
      photoUrls: [], childNote: '真的澆了', aiResult: null, aiConfidence: null,
      submittedAt: serverTimestamp(),
    });
    batch.update(doc(C.db, 'taskInstances', instance5Id), {
      status: 'submitted', submissionCount: increment(1), submittedAt: serverTimestamp(),
    });
    await batch.commit();
  });

  // ========== 20. R3-6：markMissed 收窄——approved 終態不被蓋掉 ==========
  // 鏡像 src/lib/instances.ts updateInstanceIfStatusIn（tasks.tsx markMissed 用法）：
  // 交易內重讀 status，僅 IN_PROGRESS 三態（pending/submitted/rejected）才寫 missed。
  // instanceId 自第 5 節起是 approved（pointsAwarded=100 的點數帳本歷史）。
  //
  // ⚠️ 手抄鏡像，非出貨 client 碼（RN module 無法在 node E2E 直跑）：
  // 20.1/20.3 驗的是這份鏡像＋rules 的組合行為，真本體（updateInstanceIfStatusIn）
  // 由 src/lib/__tests__/instances.test.ts（app jest，plan §6）覆蓋；後端唯一閘門是
  // 20.2 的 rules（R2-CX1 既有矩陣，R3-6 未新增 rules）。改動 updateInstanceIfStatusIn
  // 的允許狀態/寫入欄位、或 src/lib/taskAssignments.ts 的 IN_PROGRESS_STATUSES 時，
  // 必須同步改下方鏡像（兩檔已加回指註解，雙向指標）。
  const IN_PROGRESS_STATUSES = ['pending', 'submitted', 'rejected'];
  async function markMissedGuarded(client, instId) {
    await runTransaction(client.db, async (tx) => {
      const snap = await tx.get(doc(client.db, 'taskInstances', instId));
      if (!snap.exists()) throw new Error('INSTANCE_GONE');
      const status = snap.data().status;
      if (!IN_PROGRESS_STATUSES.includes(status)) throw new Error('INSTANCE_NOT_SUBMITTED');
      tx.update(doc(client.db, 'taskInstances', instId), { status: 'missed' });
    });
  }
  await step('20.1 approved instance 走收窄 helper → 交易重讀擋下、不寫入（R3-6）', async () => {
    let threw = null;
    try { await markMissedGuarded(P, instanceId); }
    catch (e) { threw = String(e && e.message); }
    if (!threw || !threw.includes('INSTANCE_NOT_SUBMITTED')) {
      throw new Error(`預期 INSTANCE_NOT_SUBMITTED，拿到：${threw ?? '成功寫入（approved 被蓋掉）'}`);
    }
    const i = await adb.collection('taskInstances').doc(instanceId).get();
    if (i.data().status !== 'approved') throw new Error(`status=${i.data().status}（終態被蓋）`);
    if (i.data().pointsAwarded !== 100) throw new Error(`pointsAwarded=${i.data().pointsAwarded}`);
  });
  await expectDenied('20.2 裸 update approved→missed 也被 rules 擋（舊版 client 防禦縱深）', () =>
    updateDoc(doc(P.db, 'taskInstances', instanceId), { status: 'missed' }));
  await step('20.3 submitted instance 走同 helper → 成功標 missed（解除指派語意不變）', async () => {
    await markMissedGuarded(P, instance5Id); // 19.5 提交後是 submitted
    const i = await adb.collection('taskInstances').doc(instance5Id).get();
    if (i.data().status !== 'missed') throw new Error(`status=${i.data().status}`);
  });

  // ========== 21. R3-3：removeFamilyMember 全鏈（守衛 → 移除＋作廢 → 擋復用 → reactivate）==========
  // client 直改 status:'removed' 已被 rules 禁止；移除只能走 CF（原子作廢 pending 邀請）。
  // 本節放最後：小孩會短暫被移除，末尾用同家庭重邀 reactivate 復原（同時證明 R3-1
  // 的跨家庭守衛不誤擋同家庭 reactivate——R2-29 鏈零退化）。
  let revInviteId;
  await step('21.1 佈置：家長對小孩 email 再發一張 pending 邀請（待作廢標的）', async () => {
    const fn = httpsCallable(P.fns, 'createFamilyInvite');
    const res = await fn({ familyId, email: kidEmail, childName: '小安' });
    revInviteId = res.data.inviteId;
    if (!revInviteId) throw new Error('沒回 inviteId');
  });
  await expectCallableError('21.2 小孩（非家長）呼叫 removeFamilyMember 被擋（NOT_PARENT）', async () => {
    const fn = httpsCallable(C.fns, 'removeFamilyMember');
    await fn({ familyId, memberUserId: dadUid });
  }, 'permission-denied', 'NOT_PARENT');
  await expectCallableError('21.3 移除不存在的成員（MEMBER_NOT_FOUND）', async () => {
    const fn = httpsCallable(P.fns, 'removeFamilyMember');
    await fn({ familyId, memberUserId: `no-such-user-${runTag}` });
  }, 'not-found', 'MEMBER_NOT_FOUND');
  await expectCallableError('21.4 家長移除自己被擋（CANNOT_REMOVE_SELF）', async () => {
    const fn = httpsCallable(P.fns, 'removeFamilyMember');
    await fn({ familyId, memberUserId: dadUid });
  }, 'failed-precondition', 'CANNOT_REMOVE_SELF');
  await expectDenied('21.5 client 直改 membership status→removed 被 rules 擋（R3-3 rules 收緊）', () =>
    updateDoc(doc(P.db, 'familyMemberships', `${kidUid}_${familyId}`), { status: 'removed' }));
  await step('21.6 rules 零退化：家長改成員暱稱（family.tsx handleSave 路徑）仍放行', async () => {
    await updateDoc(doc(P.db, 'familyMemberships', `${kidUid}_${familyId}`), {
      nickname: '小安安', avatarEmoji: '🐣',
    });
  });
  let joinedAtBefore;
  await step('21.7 removeFamilyMember 成功：removed=true、revokedInvites=1', async () => {
    const m0 = await adb.collection('familyMemberships').doc(`${kidUid}_${familyId}`).get();
    joinedAtBefore = m0.data().joinedAt; // 移除前記下，驗證欄位保留
    const fn = httpsCallable(P.fns, 'removeFamilyMember');
    const res = await fn({ familyId, memberUserId: kidUid });
    if (res.data.removed !== true) throw new Error(`removed=${res.data.removed}`);
    if (res.data.revokedInvites !== 1) throw new Error(`revokedInvites=${res.data.revokedInvites} != 1`);
    if (res.data.warning) throw new Error(`不該有 warning：${res.data.warning}`);
  });
  await step('21.8 後端驗證：membership removed（joinedAt 保留）＋邀請 revoked＋錢包不動', async () => {
    const m = await adb.collection('familyMemberships').doc(`${kidUid}_${familyId}`).get();
    if (m.data().status !== 'removed') throw new Error(`membership status=${m.data().status}`);
    if (!m.data().removedAt || m.data().removedBy !== dadUid) throw new Error('removedAt/removedBy 未寫入');
    if (!m.data().joinedAt || !m.data().joinedAt.isEqual(joinedAtBefore)) throw new Error('joinedAt 被動過');
    const inv = await adb.collection('familyInvites').doc(revInviteId).get();
    if (inv.data().status !== 'revoked') throw new Error(`邀請 status=${inv.data().status}`);
    if (!inv.data().revokedAt || inv.data().revokedBy !== dadUid) throw new Error('revokedAt/revokedBy 未寫入');
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 30) throw new Error(`餘額 ${w.data().balance} != 30（移除動到錢包）`);
  });
  await expectCallableError('21.9 拿 revoked 邀請 accept 被擋（INVITE_ALREADY_USED）', async () => {
    const fn = httpsCallable(C.fns, 'acceptFamilyInvite');
    await fn({ inviteId: revInviteId });
  }, 'failed-precondition', 'INVITE_ALREADY_USED');
  await expectDenied('21.10 revoked 邀請未登入不可讀（A16 延伸：get 僅限 pending）', async () => {
    const snap = await getDoc(doc(G.db, 'familyInvites', revInviteId));
    if (snap.exists()) throw Object.assign(new Error('讀到了'), { code: 'unexpected-success' });
  });
  await expectDenied('21.11 被移除成員讀家庭資料被 rules 擋（A17 重演）', () =>
    getDoc(doc(C.db, 'families', familyId)));
  await step('21.12 同家庭重邀＋接受成功（reactivate 不被 R3-1 誤擋，R2-29 鏈零退化）', async () => {
    const fn = httpsCallable(P.fns, 'createFamilyInvite');
    const res = await fn({ familyId, email: kidEmail, childName: '小安' });
    const fn2 = httpsCallable(C.fns, 'acceptFamilyInvite');
    const res2 = await fn2({ inviteId: res.data.inviteId });
    if (res2.data.familyId !== familyId) throw new Error('familyId 不符');
  });
  await step('21.13 復原驗證：membership 回 active、joinedAt/暱稱保留、錢包 30 原封不動', async () => {
    const m = await adb.collection('familyMemberships').doc(`${kidUid}_${familyId}`).get();
    if (m.data().status !== 'active') throw new Error(`status=${m.data().status}`);
    if (!m.data().joinedAt.isEqual(joinedAtBefore)) throw new Error('joinedAt 被重置');
    if (m.data().nickname !== '小安安') throw new Error(`nickname=${m.data().nickname}（被重置）`);
    const w = await adb.collection('pointWallets').doc(`${familyId}_${childId}`).get();
    if (w.data().balance !== 30) throw new Error(`餘額 ${w.data().balance} != 30`);
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
