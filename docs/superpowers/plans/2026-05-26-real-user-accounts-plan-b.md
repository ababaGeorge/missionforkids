# Plan B — email 邀請 + 小孩接受註冊 + acceptFamilyInvite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 家長用小孩 email 寄出邀請信 → 小孩點 deep link → 設定真帳號 → 自動綁進邀請者的家庭並建立確定性點數錢包。

**Architecture:** 兩個新 callable（`createFamilyInvite`、`acceptFamilyInvite`）+ `familyInvites` collection + `FamilyInvite` type。寄信封成可注入 mock 的 `sendInviteEmail`（node 22 raw fetch 打 Resend REST，零新依賴）。`acceptFamilyInvite` 在 transaction 內產生小孩 `childId`、建 user(child) + membership + 確定性錢包 `{familyId}_{childId}` + 標記 invite accepted。接受畫面走既有 `missionforkids://` 自訂 scheme（expo-router 路由 `/invite/[inviteId]`）。

**Tech Stack:** firebase-functions v6 (v2 API)、firebase-admin v13、Firestore emulator、`firebase-functions-test`、Resend REST（raw fetch）、`defineSecret`、Expo 54 / expo-router 6 / expo-linking 8、`@react-native-firebase` v24、jest-expo + RNTL v13。

**Branch:** `feat/real-user-accounts`

**範圍邊界（重要）：** 本計畫只為「新小孩帳號」引入 `childId`（`acceptFamilyInvite` 產生 + 建 `{familyId}_{childId}` 錢包）。**改寫既有點數流程（grantPoints / onTaskInstanceApproved / onRewardOrderCreated / 各頁讀取）到 childId 屬 Plan C，本計畫不碰。**

**相容性約束（見 `.specs/compatibility-report.md` Plan B 附錄）：**
- 寄信用 node 22 raw `fetch` 打 `https://api.resend.com/emails`，**不裝 resend SDK**。
- 金鑰用 `defineSecret('RESEND_API_KEY')`，照 `functions/src/analyzePhoto.ts` 既有模式；本機 emulator 用 `functions/.secret.local`。
- deep link 只用既有 `missionforkids://` scheme，**不改 app.json 原生 linking**（不觸發重 build）；universal link 延後上線前。
- 測試寄件用 `from: 'onboarding@resend.dev'`（免驗證網域）。

**前置（人工，非本計畫步驟，且不擋本計畫 TDD 開發）：**
- Resend 帳號 + API key（真正寄信驗證才需要；後端測試全程 mock）。
- 上線前：`! firebase functions:secrets:set RESEND_API_KEY`、Firebase Console 啟用 Email/Password、驗證自有寄件網域、universal link hosting。

---

## 檔案結構

| 檔案 | 責任 | 動作 |
|---|---|---|
| `src/types/models.ts` | 加 `FamilyInvite` type、`childId` 欄位（groundwork） | Modify |
| `functions/src/lib/sendInviteEmail.ts` | 寄邀請信（raw fetch Resend，可注入 fetch） | Create |
| `functions/src/lib/__tests__/sendInviteEmail.test.ts` | 上者測試（注入 fake fetch，不打網路） | Create |
| `functions/src/createFamilyInvite.ts` | callable：家長建邀請 + 觸發寄信 | Create |
| `functions/src/__tests__/createFamilyInvite.test.ts` | 上者測試（mock sendInviteEmail） | Create |
| `functions/src/acceptFamilyInvite.ts` | callable：小孩接受 → 建 child 帳號+錢包+membership | Create |
| `functions/src/__tests__/acceptFamilyInvite.test.ts` | 上者測試 | Create |
| `functions/src/index.ts` | 匯出兩個新 function | Modify |
| `firestore.rules` | 加 `familyInvites` 規則（get 公開、寫 admin-only） | Modify |
| `src/lib/familyInvite.ts` | client：createFamilyInvite 封裝 + 讀 invite | Create |
| `src/lib/auth/registerChild.ts` | client：小孩 signup + acceptFamilyInvite | Create |
| `src/lib/auth/__tests__/registerChild.test.ts` | 上者測試 | Create |
| `src/app/invite/[inviteId].tsx` | 接受邀請畫面（deep link 落地） | Create |
| `src/app/parent/(tabs)/family.tsx` | 加「用 email 邀請小孩」入口 | Modify |

---

## Section 1：資料模型

### Task 1.1：加 `FamilyInvite` type 與 `childId` 欄位

**Files:**
- Modify: `src/types/models.ts`

- [ ] **Step 1: `User` 加 `childId`（optional groundwork）**

把 `src/types/models.ts` 的 `User` interface 末尾（`createdAt` 後）加一行：
```typescript
  // 小孩專用：點數釘 childId（值預設 = 當下 uid）。家長為 undefined。
  childId?: string;
```

- [ ] **Step 2: `FamilyMembership` 加 `childId`**

在 `FamilyMembership` interface 的 `avatarEmoji?` 後加：
```typescript
  childId?: string | null;
```

- [ ] **Step 3: `PointWallet` 加 `childId`**

把 `PointWallet` interface 改成（`userId` 保留供既有讀取相容；新增 `childId`）：
```typescript
export interface PointWallet {
  id: string;
  userId: string;
  childId?: string;
  familyId: string;
  balance: number;
  updatedAt: Timestamp;
}
```

- [ ] **Step 4: 新增 `FamilyInvite` type**

在「一、帳號與家庭結構」區塊末尾（`FamilyMembership` 之後）加入：
```typescript
export type FamilyInviteStatus = 'pending' | 'accepted' | 'expired';

export interface FamilyInviteChildProfile {
  displayName: string;
  nickname: string | null;
  avatarEmoji: string | null;
}

export interface FamilyInvite {
  id: string;
  email: string;
  familyId: string;
  role: 'child';
  invitedBy: string;
  status: FamilyInviteStatus;
  childProfile: FamilyInviteChildProfile;
  acceptedBy: string | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}
```

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS（新增欄位皆 optional 或新 type，不破壞既有）。

- [ ] **Step 6: Commit**

```bash
git add src/types/models.ts
git commit -m "feat(model): 加 FamilyInvite type 與 childId 欄位 (Plan B groundwork)"
```

---

## Section 2：寄信抽象（raw fetch Resend）

### Task 2.1：`sendInviteEmail` helper 並 TDD

**Files:**
- Create: `functions/src/lib/sendInviteEmail.ts`
- Create: `functions/src/lib/__tests__/sendInviteEmail.test.ts`

合約：`sendInviteEmail(params, deps?)` 用 raw fetch 打 Resend REST。`deps.fetchImpl` 預設 `globalThis.fetch`（node 22 內建），測試注入 fake。Resend 回非 2xx 時 throw。`apiKey` 由呼叫端帶入（function 從 secret 取）。

- [ ] **Step 1: 寫失敗測試**

Create `functions/src/lib/__tests__/sendInviteEmail.test.ts`:
```typescript
import { sendInviteEmail } from '../sendInviteEmail';

describe('sendInviteEmail', () => {
  it('用注入的 fetch 打 Resend，帶 Bearer key、收件人、deep link', async () => {
    const calls: any[] = [];
    const fakeFetch = jest.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ id: 'email-1' }) } as any;
    });

    await sendInviteEmail(
      {
        to: 'kid@example.com',
        familyName: '我們家',
        inviteId: 'inv-123',
        apiKey: 're_test',
      },
      { fetchImpl: fakeFetch as any }
    );

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(calls[0].init.body);
    expect(body.to).toEqual(['kid@example.com']);
    expect(body.from).toContain('onboarding@resend.dev');
    expect(body.html).toContain('missionforkids://invite/inv-123');
    expect(body.subject).toContain('我們家');
  });

  it('Resend 回非 2xx 時 throw', async () => {
    const fakeFetch = jest.fn(async () => ({
      ok: false,
      status: 422,
      text: async () => 'invalid',
    })) as any;

    await expect(
      sendInviteEmail(
        { to: 'x@e.com', familyName: 'F', inviteId: 'i', apiKey: 'k' },
        { fetchImpl: fakeFetch }
      )
    ).rejects.toThrow(/resend/i);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd functions && npm test -- sendInviteEmail`
Expected: FAIL（`Cannot find module '../sendInviteEmail'`）。

- [ ] **Step 3: 實作 `functions/src/lib/sendInviteEmail.ts`**

```typescript
export interface SendInviteEmailParams {
  to: string;
  familyName: string;
  inviteId: string;
  apiKey: string;
}

export interface SendInviteEmailDeps {
  fetchImpl?: typeof fetch;
}

// 測試階段用 onboarding@resend.dev（免驗證網域）；上線前換自有寄件網域。
const FROM = 'Mission for Kids <onboarding@resend.dev>';

export async function sendInviteEmail(
  params: SendInviteEmailParams,
  deps: SendInviteEmailDeps = {}
): Promise<void> {
  const doFetch = deps.fetchImpl ?? globalThis.fetch;
  const link = `missionforkids://invite/${params.inviteId}`;
  const html =
    `<p>你被邀請加入「${params.familyName}」。</p>` +
    `<p><a href="${link}">點此開啟 Mission for Kids 接受邀請</a></p>` +
    `<p>若連結無法點擊，請複製：${link}</p>`;

  const res = await doFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [params.to],
      subject: `邀請你加入「${params.familyName}」`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = typeof res.text === 'function' ? await res.text() : '';
    throw new Error(`Resend 寄信失敗 (${res.status}): ${detail}`);
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd functions && npm test -- sendInviteEmail`
Expected: PASS（2 個測試）。

- [ ] **Step 5: Commit**

```bash
cd .. && git add functions/src/lib/sendInviteEmail.ts functions/src/lib/__tests__/sendInviteEmail.test.ts
git commit -m "feat(functions): sendInviteEmail — raw fetch Resend (可注入 mock)"
```

---

## Section 3：createFamilyInvite callable

### Task 3.1：建 `createFamilyInvite` 並 TDD

**Files:**
- Create: `functions/src/createFamilyInvite.ts`
- Create: `functions/src/__tests__/createFamilyInvite.test.ts`

合約：已登入家長呼叫 `createFamilyInvite({ familyId, email, childName, nickname?, avatarEmoji? })`。驗證 caller 是該 family 的 active parent。在 transaction 內建 `familyInvites/{auto}`（status pending、7 天過期、childProfile）。transaction 後 best-effort 呼叫 `sendInviteEmail`（失敗不 rollback、不丟錯）。回傳 `{ inviteId, emailSent }`。

- [ ] **Step 1: 寫失敗測試**

Create `functions/src/__tests__/createFamilyInvite.test.ts`:
```typescript
import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';

// mock 寄信：不打真網路，且可斷言被呼叫
jest.mock('../lib/sendInviteEmail', () => ({
  sendInviteEmail: jest.fn(async () => undefined),
}));
import { sendInviteEmail } from '../lib/sendInviteEmail';
import { createFamilyInvite } from '../createFamilyInvite';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

async function seedParent(uid: string, familyId: string) {
  const db = admin.firestore();
  await db.collection('families').doc(familyId).set({
    displayName: '我們家',
    defaultGraceDays: 2,
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('familyMemberships').doc(`${uid}_${familyId}`).set({
    familyId,
    userId: uid,
    role: 'parent',
    status: 'active',
    invitedBy: uid,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

describe('createFamilyInvite', () => {
  beforeEach(() => jest.clearAllMocks());

  it('家長建 invite doc（pending）並觸發寄信，回傳 inviteId', async () => {
    const uid = 'parent-1';
    const familyId = 'fam-1';
    await seedParent(uid, familyId);

    const res: any = await fft.wrap(createFamilyInvite)({
      data: { familyId, email: 'kid@example.com', childName: '小明', nickname: '阿明' },
      auth: { uid, token: { email: 'mom@example.com' } },
    } as any);

    expect(res.inviteId).toBeTruthy();
    expect(res.emailSent).toBe(true);
    expect(sendInviteEmail).toHaveBeenCalledTimes(1);

    const doc = await admin.firestore().collection('familyInvites').doc(res.inviteId).get();
    expect(doc.data()).toMatchObject({
      email: 'kid@example.com',
      familyId,
      role: 'child',
      status: 'pending',
      invitedBy: uid,
      acceptedBy: null,
    });
    expect(doc.data()?.childProfile).toMatchObject({ displayName: '小明', nickname: '阿明' });
  });

  it('非該家庭家長 → permission-denied', async () => {
    const familyId = 'fam-2';
    await seedParent('real-parent', familyId);
    await expect(
      fft.wrap(createFamilyInvite)({
        data: { familyId, email: 'k@e.com', childName: 'x' },
        auth: { uid: 'stranger', token: {} },
      } as any)
    ).rejects.toThrow(/permission-denied|permission/i);
  });

  it('未登入 → unauthenticated', async () => {
    await expect(
      fft.wrap(createFamilyInvite)({
        data: { familyId: 'f', email: 'k@e.com', childName: 'x' },
      } as any)
    ).rejects.toThrow(/unauthenticated/i);
  });

  it('寄信失敗不擋 invite 建立（emailSent=false，doc 仍存在）', async () => {
    (sendInviteEmail as jest.Mock).mockRejectedValueOnce(new Error('resend down'));
    const uid = 'parent-3';
    const familyId = 'fam-3';
    await seedParent(uid, familyId);

    const res: any = await fft.wrap(createFamilyInvite)({
      data: { familyId, email: 'kid@example.com', childName: '小華' },
      auth: { uid, token: {} },
    } as any);

    expect(res.emailSent).toBe(false);
    const doc = await admin.firestore().collection('familyInvites').doc(res.inviteId).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.status).toBe('pending');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd functions && npm test -- createFamilyInvite`
Expected: FAIL（找不到 `../createFamilyInvite`）。

- [ ] **Step 3: 實作 `functions/src/createFamilyInvite.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { sendInviteEmail } from './lib/sendInviteEmail';

const resendApiKey = defineSecret('RESEND_API_KEY');

const INVITE_TTL_DAYS = 7;

export const createFamilyInvite = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', '必須先登入');
    }
    const familyId = String(request.data?.familyId ?? '').trim();
    const email = String(request.data?.email ?? '').trim().toLowerCase();
    const childName = String(request.data?.childName ?? '').trim();
    const nickname = request.data?.nickname ? String(request.data.nickname).trim() : null;
    const avatarEmoji = request.data?.avatarEmoji ? String(request.data.avatarEmoji) : null;
    if (!familyId || !email || !childName) {
      throw new HttpsError('invalid-argument', 'familyId / email / childName 必填');
    }

    const db = admin.firestore();

    // 驗證 caller 是該 family 的 active parent
    const memSnap = await db
      .collection('familyMemberships')
      .doc(`${uid}_${familyId}`)
      .get();
    const mem = memSnap.exists ? memSnap.data() : null;
    if (!mem || mem.role !== 'parent' || mem.status !== 'active') {
      throw new HttpsError('permission-denied', '只有家庭家長可以邀請');
    }

    const famSnap = await db.collection('families').doc(familyId).get();
    const familyName = (famSnap.data()?.displayName as string) || '家庭';

    const now = admin.firestore.FieldValue.serverTimestamp();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const inviteRef = db.collection('familyInvites').doc();
    await inviteRef.set({
      email,
      familyId,
      role: 'child',
      invitedBy: uid,
      status: 'pending',
      childProfile: { displayName: childName, nickname, avatarEmoji },
      acceptedBy: null,
      createdAt: now,
      expiresAt,
    });

    // 寄信 best-effort：失敗不 rollback invite，回傳可重寄
    let emailSent = false;
    try {
      await sendInviteEmail({
        to: email,
        familyName,
        inviteId: inviteRef.id,
        apiKey: resendApiKey.value(),
      });
      emailSent = true;
    } catch (e: any) {
      logger.warn('[createFamilyInvite] 寄信失敗 (non-fatal)', {
        inviteId: inviteRef.id,
        error: e?.message,
      });
    }

    return { inviteId: inviteRef.id, emailSent };
  }
);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd functions && npm test -- createFamilyInvite`
Expected: PASS（4 個測試）。

注意：`onCall` 帶 `secrets` 後，`firebase-functions-test` 的 `wrap` 不需真 secret 值即可跑（測試已 mock `sendInviteEmail`，不會讀 `.value()` 失敗路徑）。若 `resendApiKey.value()` 在測試環境丟錯，於測試檔頂部加 `process.env.RESEND_API_KEY = 're_test';`。

- [ ] **Step 5: Commit**

```bash
cd .. && git add functions/src/createFamilyInvite.ts functions/src/__tests__/createFamilyInvite.test.ts
git commit -m "feat(functions): createFamilyInvite — 家長建邀請+寄信(失敗不擋建立)"
```

---

## Section 4：acceptFamilyInvite callable

### Task 4.1：建 `acceptFamilyInvite` 並 TDD

**Files:**
- Create: `functions/src/acceptFamilyInvite.ts`
- Create: `functions/src/__tests__/acceptFamilyInvite.test.ts`

合約：小孩 client 先 `createUserWithEmailAndPassword` 拿 uid，再呼叫 `acceptFamilyInvite({ inviteId })`。transaction 內：驗證 invite pending 且未過期；產生 `childId`（= 當下 uid）；建 `users/{uid}`(child, childId)、`familyMemberships/{uid}_{familyId}`(childId, active, 帶 invite.childProfile 的 nickname/avatar)、`pointWallets/{familyId}_{childId}`(balance 0)；標記 invite `accepted` + `acceptedBy`。回傳 `{ familyId, childId }`。冪等：同一 uid 重呼叫回傳既有。

- [ ] **Step 1: 寫失敗測試**

Create `functions/src/__tests__/acceptFamilyInvite.test.ts`:
```typescript
import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { acceptFamilyInvite } from '../acceptFamilyInvite';

const fft = functionsTest({ projectId: 'mission-for-kids' });
afterAll(() => fft.cleanup());

async function seedInvite(
  inviteId: string,
  familyId: string,
  overrides: Record<string, any> = {}
) {
  const db = admin.firestore();
  await db.collection('familyInvites').doc(inviteId).set({
    email: 'kid@example.com',
    familyId,
    role: 'child',
    invitedBy: 'parent-1',
    status: 'pending',
    childProfile: { displayName: '小明', nickname: '阿明', avatarEmoji: '🦊' },
    acceptedBy: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 86400000),
    ...overrides,
  });
}

describe('acceptFamilyInvite', () => {
  it('小孩接受 → 建 child user + childId membership + 確定性錢包，標記 accepted', async () => {
    const uid = 'child-uid-1';
    const familyId = 'fam-1';
    await seedInvite('inv-1', familyId);

    const res: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-1' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);

    expect(res.familyId).toBe(familyId);
    expect(res.childId).toBe(uid); // childId 預設 = uid

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()).toMatchObject({
      roleType: 'child',
      childId: uid,
      email: 'kid@example.com',
      authProvider: 'password',
    });

    const memDoc = await db.collection('familyMemberships').doc(`${uid}_${familyId}`).get();
    expect(memDoc.data()).toMatchObject({
      userId: uid,
      childId: uid,
      role: 'child',
      status: 'active',
      familyId,
      nickname: '阿明',
      avatarEmoji: '🦊',
    });

    const walletDoc = await db.collection('pointWallets').doc(`${familyId}_${uid}`).get();
    expect(walletDoc.data()).toMatchObject({
      childId: uid,
      userId: uid,
      familyId,
      balance: 0,
    });

    const invDoc = await db.collection('familyInvites').doc('inv-1').get();
    expect(invDoc.data()).toMatchObject({ status: 'accepted', acceptedBy: uid });
  });

  it('未登入 → unauthenticated', async () => {
    await seedInvite('inv-2', 'fam-2');
    await expect(
      fft.wrap(acceptFamilyInvite)({ data: { inviteId: 'inv-2' } } as any)
    ).rejects.toThrow(/unauthenticated/i);
  });

  it('invite 不存在 → not-found INVALID_INVITE', async () => {
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'nope' },
        auth: { uid: 'c', token: {} },
      } as any)
    ).rejects.toThrow(/INVALID_INVITE/);
  });

  it('invite 已過期 → failed-precondition INVITE_EXPIRED', async () => {
    await seedInvite('inv-3', 'fam-3', {
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000),
    });
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-3' },
        auth: { uid: 'c', token: {} },
      } as any)
    ).rejects.toThrow(/INVITE_EXPIRED/);
  });

  it('冪等：同一個 uid 再呼叫回傳既有、不報錯', async () => {
    const uid = 'child-uid-4';
    const familyId = 'fam-4';
    await seedInvite('inv-4', familyId);
    const first: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-4' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);
    const second: any = await fft.wrap(acceptFamilyInvite)({
      data: { inviteId: 'inv-4' },
      auth: { uid, token: { email: 'kid@example.com' } },
    } as any);
    expect(second).toEqual(first);
  });

  it('invite 已被別人接受 → failed-precondition INVITE_ALREADY_USED', async () => {
    await seedInvite('inv-5', 'fam-5', { status: 'accepted', acceptedBy: 'someone-else' });
    await expect(
      fft.wrap(acceptFamilyInvite)({
        data: { inviteId: 'inv-5' },
        auth: { uid: 'different-child', token: {} },
      } as any)
    ).rejects.toThrow(/INVITE_ALREADY_USED/);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd functions && npm test -- acceptFamilyInvite`
Expected: FAIL（找不到 `../acceptFamilyInvite`）。

- [ ] **Step 3: 實作 `functions/src/acceptFamilyInvite.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const acceptFamilyInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', '必須先登入');
  }
  const inviteId = String(request.data?.inviteId ?? '').trim();
  if (!inviteId) {
    throw new HttpsError('invalid-argument', 'inviteId 必填');
  }
  const email = (request.auth?.token?.email as string | undefined) ?? null;
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async (tx) => {
    const inviteRef = db.collection('familyInvites').doc(inviteId);
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) {
      throw new HttpsError('not-found', 'INVALID_INVITE');
    }
    const invite = inviteSnap.data()!;
    const familyId = invite.familyId as string;
    const childId = uid; // childId 預設 = 當下 uid

    // 冪等：同一 uid 已接受過 → 回傳既有
    if (invite.status === 'accepted') {
      if (invite.acceptedBy === uid) {
        return { familyId, childId };
      }
      throw new HttpsError('failed-precondition', 'INVITE_ALREADY_USED');
    }
    if (invite.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'INVITE_ALREADY_USED');
    }
    if ((invite.expiresAt as admin.firestore.Timestamp).toDate() < new Date()) {
      throw new HttpsError('failed-precondition', 'INVITE_EXPIRED');
    }

    const profile = invite.childProfile ?? {};

    tx.set(db.collection('users').doc(uid), {
      displayName: profile.displayName ?? '小孩',
      avatarUrl: null,
      authProvider: 'password',
      authProviderId: uid,
      roleType: 'child',
      childId,
      email,
      birthday: null,
      createdAt: now,
    });

    tx.set(db.collection('familyMemberships').doc(`${uid}_${familyId}`), {
      familyId,
      userId: uid,
      childId,
      role: 'child',
      status: 'active',
      invitedBy: invite.invitedBy ?? null,
      joinedAt: now,
      nickname: profile.nickname ?? null,
      avatarEmoji: profile.avatarEmoji ?? null,
    });

    // 確定性錢包 {familyId}_{childId}；childId == uid，故 doc id 與既有 userId 慣例一致。
    // 同時寫 childId 與 userId，讓 Plan C 之前的「where userId == uid」讀取仍相容。
    tx.set(db.collection('pointWallets').doc(`${familyId}_${childId}`), {
      childId,
      userId: uid,
      familyId,
      balance: 0,
      updatedAt: now,
    });

    tx.update(inviteRef, { status: 'accepted', acceptedBy: uid });

    return { familyId, childId };
  });
});
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd functions && npm test -- acceptFamilyInvite`
Expected: PASS（6 個測試）。

- [ ] **Step 5: Commit**

```bash
cd .. && git add functions/src/acceptFamilyInvite.ts functions/src/__tests__/acceptFamilyInvite.test.ts
git commit -m "feat(functions): acceptFamilyInvite — 小孩接受建childId帳號+確定性錢包(transaction+冪等)"
```

### Task 4.2：匯出兩個新 function

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: 加匯出**

在 `functions/src/index.ts` 末尾（`bootstrapParentAccount` 那行後）加兩行：
```typescript
export { createFamilyInvite } from './createFamilyInvite';
export { acceptFamilyInvite } from './acceptFamilyInvite';
```

- [ ] **Step 2: functions build 確認**

Run: `cd functions && npm run build`
Expected: `tsc` 無錯誤。

- [ ] **Step 3: Commit**

```bash
cd .. && git add functions/src/index.ts
git commit -m "chore(functions): 匯出 createFamilyInvite / acceptFamilyInvite"
```

---

## Section 5：Firestore 規則

### Task 5.1：`familyInvites` 規則

**Files:**
- Modify: `firestore.rules`

問題：接受畫面要在小孩「還沒有帳號」時顯示「你被邀請加入 X」，需 pre-auth 讀 invite。inviteId 是隨機不可猜的 doc id，等同邀請連結本身的秘密 → 允許單 doc `get`（不允許 `list`）；寫入只走 admin（function）。

- [ ] **Step 1: 加規則區塊**

在 `firestore.rules` 的 `match /inviteCodes/...` 區塊之後加入：
```
    // ========== Family Invites（email 邀請）==========
    // inviteId 為隨機不可猜 doc id（= 邀請連結秘密）。允許單 doc get（接受畫面 pre-auth 顯示），
    // 禁 list；寫入只走 Cloud Functions (admin)。
    match /familyInvites/{inviteId} {
      allow get: if true;
      allow list: if false;
      allow write: if false;
    }
```

- [ ] **Step 2: 規則語法驗證**

Run: `firebase emulators:exec --only firestore 'echo rules-ok'`
Expected: emulator 載入 `firestore.rules` 無語法錯誤，印出 `rules-ok`。（若報規則錯誤會在啟動階段失敗。）

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): familyInvites — 單 doc get 公開、寫入 admin-only"
```

> **部署備註（人工，非本步驟）：** rules 上線需 `! firebase deploy --only firestore:rules`（走 `!` 前綴）。functions 上線需先設好 `RESEND_API_KEY` secret 再 `! firebase deploy --only functions`。

---

## Section 6：client 封裝

### Task 6.1：`familyInvite` client（建邀請 + 讀 invite）

**Files:**
- Create: `src/lib/familyInvite.ts`

- [ ] **Step 1: 實作 `src/lib/familyInvite.ts`**

```typescript
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { FamilyInvite } from '../types/models';

export interface CreateFamilyInviteInput {
  familyId: string;
  email: string;
  childName: string;
  nickname?: string;
  avatarEmoji?: string;
}

export async function createFamilyInvite(
  input: CreateFamilyInviteInput
): Promise<{ inviteId: string; emailSent: boolean }> {
  const fn = functions().httpsCallable('createFamilyInvite');
  const res = await fn(input);
  return res.data as { inviteId: string; emailSent: boolean };
}

// 接受畫面 pre-auth 讀 invite 顯示用（rules 允許單 doc get）
export async function getFamilyInvite(
  inviteId: string
): Promise<FamilyInvite | null> {
  const snap = await firestore().collection('familyInvites').doc(inviteId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as object) } as FamilyInvite;
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/lib/familyInvite.ts
git commit -m "feat(invite): familyInvite client — 建邀請 + 讀 invite 顯示"
```

### Task 6.2：`registerChild` client 並 TDD

**Files:**
- Create: `src/lib/auth/registerChild.ts`
- Create: `src/lib/auth/__tests__/registerChild.test.ts`

合約：`registerChild({ inviteId, email, password })` → `auth().createUserWithEmailAndPassword` → 呼叫 callable `acceptFamilyInvite` → 回傳 `{ familyId, childId }`。

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/auth/__tests__/registerChild.test.ts`:
```typescript
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { registerChild } from '../registerChild';

describe('registerChild', () => {
  beforeEach(() => jest.clearAllMocks());

  it('先建 auth 帳號再呼叫 acceptFamilyInvite，回傳 familyId/childId', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    createUser.mockResolvedValue({ user: { uid: 'child-uid' } });

    const callable = jest.fn(async () => ({ data: { familyId: 'fam-1', childId: 'child-uid' } }));
    (functions as any).__mocks.httpsCallable.mockReturnValue(callable);

    const res = await registerChild({
      inviteId: 'inv-1',
      email: 'kid@example.com',
      password: 'secret123',
    });

    expect(createUser).toHaveBeenCalledWith('kid@example.com', 'secret123');
    expect((functions as any).__mocks.httpsCallable).toHaveBeenCalledWith('acceptFamilyInvite');
    expect(callable).toHaveBeenCalledWith({ inviteId: 'inv-1' });
    expect(res).toEqual({ familyId: 'fam-1', childId: 'child-uid' });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- registerChild`
Expected: FAIL（找不到 `../registerChild`）。

- [ ] **Step 3: 實作 `src/lib/auth/registerChild.ts`**

```typescript
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export interface RegisterChildInput {
  inviteId: string;
  email: string;
  password: string;
}

export async function registerChild(
  input: RegisterChildInput
): Promise<{ familyId: string; childId: string }> {
  await auth().createUserWithEmailAndPassword(input.email, input.password);
  const fn = functions().httpsCallable('acceptFamilyInvite');
  const res = await fn({ inviteId: input.inviteId });
  return res.data as { familyId: string; childId: string };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- registerChild`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/registerChild.ts src/lib/auth/__tests__/registerChild.test.ts
git commit -m "feat(auth): registerChild client 封裝 (signup + acceptFamilyInvite)"
```

---

## Section 7：UI — 家長邀請入口 + 小孩接受畫面

### Task 7.1：接受邀請畫面（deep link 落地）

**Files:**
- Create: `src/app/invite/[inviteId].tsx`

說明：expo-router 把 `missionforkids://invite/<id>` 對應到此檔。畫面讀 invite 顯示「你被邀請加入〔家庭〕為〔暱稱〕」，小孩設 email（由 invite 預填）/密碼 → `registerChild` → 進小孩頁。沿用 Plan A sign-in 的 design tokens。

- [ ] **Step 1: 實作 `src/app/invite/[inviteId].tsx`**

```tsx
import { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { P, spacing, radius, shadow } from '../../design/tokens';
import { Starfield } from '../../design/Starfield';
import { Display, BodySm, AppText } from '../../design/Text';
import { getFamilyInvite } from '../../lib/familyInvite';
import { registerChild } from '../../lib/auth/registerChild';
import type { FamilyInvite } from '../../types/models';

export default function AcceptInvite() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const inv = inviteId ? await getFamilyInvite(String(inviteId)) : null;
        if (!active) return;
        setInvite(inv);
        if (inv?.email) setEmail(inv.email);
      } finally {
        if (active) setLoadingInvite(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [inviteId]);

  const handleAccept = async () => {
    if (!email.trim() || !password || !inviteId) return;
    try {
      setSubmitting(true);
      await registerChild({ inviteId: String(inviteId), email: email.trim(), password });
      router.replace('/child/(tabs)/tasks');
    } catch (e: any) {
      let msg = e?.message ?? '接受邀請失敗';
      if (/INVITE_EXPIRED/.test(msg)) msg = '邀請已過期';
      if (/INVITE_ALREADY_USED/.test(msg)) msg = '邀請已被使用';
      if (/INVALID_INVITE/.test(msg)) msg = '邀請無效';
      Alert.alert('無法加入', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite || submitting) {
    return (
      <View style={styles.center}>
        <Starfield />
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  if (!invite || invite.status !== 'pending') {
    return (
      <View style={styles.center}>
        <Starfield />
        <BodySm style={{ color: P.muted }}>這個邀請無效或已被使用。</BodySm>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Starfield />
      <SafeAreaView style={styles.body} edges={['top', 'bottom']}>
        <Display style={styles.title}>你被邀請加入</Display>
        <BodySm style={styles.sub}>
          「{invite.childProfile?.displayName ?? '小孩'}」加入家庭
          {invite.childProfile?.nickname ? `（暱稱：${invite.childProfile.nickname}）` : ''}
        </BodySm>
        <View style={{ gap: spacing.sm, width: '100%', marginTop: spacing.lg }}>
          <TextInput
            testID="invite-email"
            placeholder="Email"
            placeholderTextColor={P.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            testID="invite-password"
            placeholder="設定密碼"
            placeholderTextColor={P.muted}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Pressable
            testID="invite-submit"
            onPress={handleAccept}
            disabled={submitting}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.7 }]}
          >
            <AppText style={styles.primaryBtnText}>建立帳號並加入</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  title: { color: P.text, fontSize: 28, textAlign: 'center' },
  sub: { color: P.muted, textAlign: 'center', marginTop: spacing.xs },
  input: {
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: P.text,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: P.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadow.glow,
  },
  primaryBtnText: { color: P.bg, fontSize: 15, fontWeight: '800' },
});
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS。（若 `design/tokens` 缺 `shadow.glow`/`radius.card` 等，沿用 Plan A sign-in 已用的同名 token，必存在。）

- [ ] **Step 3: deep link 路由驗證（手動）**

啟動 App（模擬器）後 Run: `npx uri-scheme open "missionforkids://invite/test-id" --ios`
Expected: App 開啟並導到接受畫面（顯示「這個邀請無效或已被使用」因 test-id 不存在 → 證明路由與讀取串通）。

- [ ] **Step 4: Commit**

```bash
git add src/app/invite/\[inviteId\].tsx
git commit -m "feat(invite): 接受邀請畫面 + deep link 落地路由"
```

### Task 7.2：家長頁加「用 email 邀請小孩」入口

**Files:**
- Modify: `src/app/parent/(tabs)/family.tsx`

說明：在家庭頁加一個用 email 邀請的入口。沿用該檔既有的 state/樣式慣例（`useState`、design tokens、現有 `handleAddChild` 附近）。實作者需先讀該檔，於現有「新增小孩」區塊旁加入。

- [ ] **Step 1: 加 state 與 handler**

在元件頂部既有 `useState` 附近加：
```typescript
const [inviteEmail, setInviteEmail] = useState('');
const [inviteName, setInviteName] = useState('');
const [inviting, setInviting] = useState(false);
```
加 handler（`familyId` 取自該頁既有的當前家庭 id 變數；若變數名不同，沿用該檔既有的家庭 id 來源）：
```typescript
const handleInviteByEmail = async () => {
  if (!inviteEmail.trim() || !inviteName.trim()) return;
  try {
    setInviting(true);
    const { createFamilyInvite } = await import('../../../lib/familyInvite');
    const { emailSent } = await createFamilyInvite({
      familyId,
      email: inviteEmail.trim(),
      childName: inviteName.trim(),
    });
    setInviteEmail('');
    setInviteName('');
    Alert.alert(
      '邀請已送出',
      emailSent ? '邀請信已寄出，請小孩查看信箱。' : '邀請已建立，但寄信失敗，稍後可重寄。'
    );
  } catch (e: any) {
    Alert.alert('邀請失敗', e?.message ?? '請重試');
  } finally {
    setInviting(false);
  }
};
```

- [ ] **Step 2: 加 UI（在現有新增小孩區塊附近）**

插入一段最小表單（沿用該檔既有 `TextInput`/`Pressable`/`AppText` 與 styles；若無對應 style 就用 inline）：
```tsx
<View style={{ gap: 8, marginTop: 12 }}>
  <AppText style={{ color: P.muted, fontWeight: '700' }}>用 Email 邀請小孩</AppText>
  <TextInput
    testID="invite-child-name"
    placeholder="小孩姓名"
    placeholderTextColor={P.muted}
    value={inviteName}
    onChangeText={setInviteName}
    style={{ backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: P.text }}
  />
  <TextInput
    testID="invite-child-email"
    placeholder="小孩 Email"
    placeholderTextColor={P.muted}
    autoCapitalize="none"
    keyboardType="email-address"
    value={inviteEmail}
    onChangeText={setInviteEmail}
    style={{ backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, color: P.text }}
  />
  <Pressable
    testID="invite-child-submit"
    onPress={handleInviteByEmail}
    disabled={inviting}
    style={({ pressed }) => [{ backgroundColor: P.primary, borderRadius: 999, paddingVertical: 12, alignItems: 'center' }, pressed && { opacity: 0.7 }]}
  >
    <AppText style={{ color: P.bg, fontWeight: '800' }}>送出邀請</AppText>
  </Pressable>
</View>
```
確認該檔已 import `P`（`../../../design/tokens`）、`TextInput`/`Pressable`/`Alert`（react-native）、`AppText`（`../../../design/Text`）；缺則補 import。

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add "src/app/parent/(tabs)/family.tsx"
git commit -m "feat(invite): 家長頁加 email 邀請小孩入口"
```

---

## Section 8：整合驗證

### Task 8.1：全套件回歸

- [ ] **Step 1: functions 測試全綠**

Run: `cd functions && npm test`
Expected: 既有 + 新增（smoke、bootstrapParentAccount、sendInviteEmail、createFamilyInvite、acceptFamilyInvite）全 PASS。

- [ ] **Step 2: RN 測試全綠**

Run: `cd .. && npm test`
Expected: 既有 + registerChild 全 PASS。

- [ ] **Step 3: 全專案型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json` 與 `cd functions && npx tsc --noEmit && cd ..`
Expected: 兩邊皆乾淨。

---

## Self-Review（規劃者自查）

**1. Spec 覆蓋（Plan B 範圍 = email 邀請 + 接受綁定）：**
- 家長邀請小孩（建 invite + Resend 寄信）→ Task 3.1 ✅
- 寄信（Resend，失敗不擋）→ Task 2.1 + 3.1 ✅
- 小孩接受並註冊（acceptFamilyInvite，transaction，建 childId + 確定性錢包 + membership + 標記 accepted）→ Task 4.1 ✅
- `familyInvites` 資料模型 + `FamilyInvite` type + `childId` 欄位 → Task 1.1 ✅
- deep link 落地（接受畫面）→ Task 7.1（custom scheme，universal link 延後）✅
- 錯誤處理（過期/已用/無效）→ Task 4.1 測試 + 7.1 訊息 ✅
- 權限驗證（建邀請需家長、接受需登入）→ Task 3.1 / 4.1 ✅
- Firestore 規則（familyInvites）→ Task 5.1 ✅
- （childId 既有點數流程改寫、密碼重設、清資料、dev seed → Plan C/D，不在 B）

**2. Placeholder 掃描：** 無 TBD/TODO；每個 code step 皆有完整程式碼與預期輸出。family.tsx 因屬大型既有檔，採 Plan A sign-in 同款「給完整 handler/UI + 描述插入點」策略，實作者讀檔整合。

**3. 型別一致性：** `createFamilyInvite({ familyId, email, childName, nickname?, avatarEmoji? })`、`acceptFamilyInvite({ inviteId })` 在後端 onCall、client 封裝、UI 呼叫三處一致；回傳 `{ inviteId, emailSent }` / `{ familyId, childId }` 一致；`FamilyInvite.childProfile` 結構在 type、createFamilyInvite 寫入、acceptFamilyInvite 讀取、接受畫面顯示四處一致；錢包 doc id `{familyId}_{childId}`、欄位 `{ childId, userId, familyId, balance }` 在 acceptFamilyInvite 與 PointWallet type 一致。

**已知後續（非本計畫）：** Plan C 把既有 grantPoints / onTaskInstanceApproved / onRewardOrderCreated / 各頁讀取改為以 childId 解析同一個 `{familyId}_{childId}` 錢包；本計畫已先鋪好 childId 欄位與新帳號的確定性錢包，Plan C 接續即可。
