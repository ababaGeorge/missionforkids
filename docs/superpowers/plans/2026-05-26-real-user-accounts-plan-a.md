# Plan A — 測試基建 + 資料模型 + 家長 email/密碼帳號 + 建家庭

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓家長能用 email/密碼註冊真帳號並建立家庭，並為整個帳號系統建立自動化測試基建（Functions + RN）。

**Architecture:** 維持「登入方式（Firebase Auth）與資料寫入（Cloud Function）分層」。家長 client 端做 `createUserWithEmailAndPassword` 拿到永久 uid → 呼叫 callable `bootstrapParentAccount` 由 Admin SDK 在 transaction 內建 `users/{uid}`(parent) + `families` + 家長 membership。測試走 Firebase emulator（Functions 用 `firebase-functions-test` + emulator；RN 用 `jest-expo` + Testing Library + mock firebase）。

**Tech Stack:** Expo 54 / React 19.1 / RN 0.81、`@react-native-firebase` v24、`firebase-functions` v6 (v2 API)、Firebase Auth + Firestore emulator、Jest、`firebase-functions-test`、`jest-expo`、`@testing-library/react-native`。

**Branch:** `feat/real-user-accounts`

**前置（人工，非本計畫步驟）：** Firebase Console 啟用 Email/Password 登入 provider（測試只用 emulator，可上線前再開）。

---

## 檔案結構

| 檔案 | 責任 | 動作 |
|---|---|---|
| `functions/package.json` | functions 測試依賴與 script | Modify |
| `functions/jest.config.js` | functions Jest 設定 | Create |
| `functions/src/__tests__/setup.ts` | 測試前把 admin 指向 emulator | Create |
| `functions/src/bootstrapParentAccount.ts` | callable：建家長 user doc + family + membership | Create |
| `functions/src/__tests__/bootstrapParentAccount.test.ts` | 上者的測試 | Create |
| `functions/src/index.ts` | 匯出新 function | Modify |
| `firebase.json` | 加 auth/firestore emulator 設定 | Modify |
| `package.json`（root） | RN 測試依賴與 script | Modify |
| `jest.config.js`（root） | RN Jest 設定（jest-expo preset） | Create |
| `jest.setup.js`（root） | RN 測試的 firebase mock | Create |
| `src/types/models.ts` | `User` 加 `email` + `'password'` provider | Modify |
| `src/lib/auth/registerParent.ts` | client：signup + 呼叫 callable 的封裝 | Create |
| `src/lib/auth/__tests__/registerParent.test.ts` | 上者的測試 | Create |
| `src/app/auth/sign-in.tsx` | 加 email/密碼 註冊+登入 UI | Modify |
| `src/app/index.tsx` | 處理「已登入但還沒 profile」狀態 | Modify |

---

## Section 0：測試基礎建設

### Task 0.1：Functions Jest + firebase-functions-test 設定

**Files:**
- Modify: `functions/package.json`
- Create: `functions/jest.config.js`
- Create: `functions/src/__tests__/setup.ts`

- [ ] **Step 1: 安裝 functions 測試依賴**

Run（版本經 compat-check 確認，見 `.specs/compatibility-report.md`）:
```bash
cd functions && npm install -D jest@^29 ts-jest@^29 @types/jest@^29 firebase-functions-test@^3.5.0
```
Expected: 安裝成功，`functions/package.json` devDependencies 出現上述 4 個套件。`firebase-functions-test@^3.5.0` peer 接受 firebase-functions >=4.9（本專案 ^6.3.0 ✓）。

- [ ] **Step 2: 在 `functions/package.json` 加測試 script**

把 `scripts` 區塊改成（保留既有，加 `test`）：
```json
"scripts": {
  "build": "tsc",
  "serve": "npm run build && firebase emulators:start --only functions",
  "shell": "npm run build && firebase functions:shell",
  "deploy": "firebase deploy --only functions",
  "test": "firebase emulators:exec --only firestore,auth 'jest --runInBand'"
}
```

- [ ] **Step 3: 建 `functions/jest.config.js`**

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
```

- [ ] **Step 4: 建 `functions/src/__tests__/setup.ts`**

emulator 由 `firebase emulators:exec` 啟動並注入 `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`。此檔確保 admin 用測試專案 id 初始化。
```typescript
import * as admin from 'firebase-admin';

// emulators:exec 會設定 FIRESTORE_EMULATOR_HOST；這裡只需確保 app 已初始化。
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'mission-for-kids' });
}

// 每個測試檔結束後清掉 firestore，避免互相污染
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
```

- [ ] **Step 5: 寫一個 smoke test 確認基建會動**

Create `functions/src/__tests__/smoke.test.ts`:
```typescript
import * as admin from 'firebase-admin';

describe('emulator smoke', () => {
  it('能寫進 firestore emulator 再讀回來', async () => {
    const db = admin.firestore();
    await db.collection('smoke').doc('x').set({ ok: true });
    const snap = await db.collection('smoke').doc('x').get();
    expect(snap.data()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 6: 跑 smoke test**

Run: `cd functions && npm test`
Expected: PASS（emulators:exec 啟動 firestore/auth → jest 通過 1 個測試）。若報 `FIRESTORE_EMULATOR_HOST` 未設，確認 `firebase.json` 已在 Task 0.3 加好 emulator（先做 0.3 再回來）。

- [ ] **Step 7: Commit**

```bash
cd .. && git add functions/package.json functions/package-lock.json functions/jest.config.js functions/src/__tests__/
git commit -m "test(functions): 建立 Jest + firebase-functions-test + emulator 測試基建"
```

### Task 0.2：Firebase emulator 設定

**Files:**
- Modify: `firebase.json`

- [ ] **Step 1: 在 `firebase.json` 加 emulators 區塊**

在 `firebase.json` 頂層物件加入（與既有 `functions`/`firestore` 同層）：
```json
"emulators": {
  "auth": { "port": 9099 },
  "firestore": { "port": 8080 },
  "ui": { "enabled": true }
}
```

- [ ] **Step 2: 驗證 emulator 能起來**

Run: `firebase emulators:start --only firestore,auth`
Expected: 看到 `✔ All emulators ready`，firestore 在 8080、auth 在 9099。確認後 Ctrl-C 關掉。

- [ ] **Step 3: Commit**

```bash
git add firebase.json
git commit -m "chore(firebase): 加 auth/firestore emulator 設定供測試使用"
```

### Task 0.3：RN Jest（jest-expo）+ Testing Library 設定

**Files:**
- Modify: `package.json`（root）
- Create: `jest.config.js`（root）
- Create: `jest.setup.js`（root）

- [ ] **Step 1: 安裝 RN 測試依賴**

Run（版本經 compat-check + 實裝驗證確認，見 `.specs/compatibility-report.md`）:
```bash
npm install -D jest-expo@54.0.13 jest@^29 @testing-library/react-native@^13.3.3 react-test-renderer@19.1.0 @types/jest@^29
```
重點（否則 EAS `npm ci` 會掛）：
- **pin `jest-expo@54.0.13`**（不要用 `npx expo install`，它會抓 54.0.17）。原因：jest-expo 54.0.14+ 帶 `react-server-dom-webpack` peer，若被強制成 19.1.5 會要求 `react ^19.1.5`，跟 App 鎖的 `react 19.1.0` 衝突，嚴格 `npm ci` 失敗。54.0.13 沒這問題，npm 會自動把（expo-router 的可選 peer）rsdw 解到相容的 **19.0.6**。
- **不要**裝 `react-server-dom-webpack`（讓 npm 自己解；手動 pin 會踩上面的雷）。
- **不要**加 `.npmrc legacy-peer-deps=true`（那會全域關掉 peer 檢查、遮蔽真問題；保持嚴格）。
- **不要**裝 `@testing-library/jest-native`（已棄用；RNTL v13 內建 matchers）。
- RNTL 要 **v13**（才支援 React 19）；它仍把 `react-test-renderer` 列 peer，故 `react-test-renderer@19.1.0` 要裝（有 React 19 棄用警告，無害）。

安裝後驗證 EAS 安全：`npm ci` 應 EXIT 0（嚴格、無 ERESOLVE）。本機已驗證通過。

- [ ] **Step 2: 在 root `package.json` 的 `scripts` 加 `test`**

```json
"scripts": {
  "start": "expo start",
  "android": "expo run:android",
  "ios": "expo run:ios",
  "web": "expo start --web",
  "test": "jest"
}
```

- [ ] **Step 3: 建 root `jest.config.js`**

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // RNTL v13 內建 matchers，不需 @testing-library/jest-native/extend-expect
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-native-firebase/.*|expo-router|@react-navigation/.*))',
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
```

- [ ] **Step 4: 建 root `jest.setup.js`（mock @react-native-firebase）**

```javascript
// RN 單元測試不連真 Firebase，這裡 mock 出 auth/firestore/functions 的呼叫面。
jest.mock('@react-native-firebase/auth', () => {
  const signInWithEmailAndPassword = jest.fn();
  const createUserWithEmailAndPassword = jest.fn();
  const signOut = jest.fn();
  const sendPasswordResetEmail = jest.fn();
  const authMock = () => ({
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    currentUser: null,
    onAuthStateChanged: jest.fn(() => jest.fn()),
  });
  authMock.__mocks = {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
  };
  return { __esModule: true, default: authMock };
});

jest.mock('@react-native-firebase/functions', () => {
  const httpsCallable = jest.fn(() => jest.fn(async () => ({ data: {} })));
  const functionsMock = () => ({ httpsCallable });
  functionsMock.__mocks = { httpsCallable };
  return { __esModule: true, default: functionsMock };
});
```

- [ ] **Step 5: 寫 RN smoke test**

Create `src/__tests__/smoke.test.ts`:
```typescript
describe('rn jest smoke', () => {
  it('基本斷言會動', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: 跑 RN 測試**

Run: `npm test`
Expected: PASS（jest-expo 載入成功，1 個測試通過）。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json jest.config.js jest.setup.js src/__tests__/
git commit -m "test(rn): 建立 jest-expo + Testing Library + firebase mock 測試基建"
```

---

## Section 1：資料模型

### Task 1.1：`User` type 加 email 與 password provider

**Files:**
- Modify: `src/types/models.ts:7-16`

- [ ] **Step 1: 改 `User` interface**

把 `src/types/models.ts` 的 `User` 改成：
```typescript
export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  authProvider: 'apple' | 'google' | 'password' | 'anonymous';
  authProviderId: string;
  roleType: 'parent' | 'child';
  email: string | null;
  birthday: Timestamp | null;
  createdAt: Timestamp;
}
```
（新增 `'password'` 與 `email`。`childId`、`FamilyInvite`、`PointWallet.childId` 留待 Plan B/C，本計畫不動。）

- [ ] **Step 2: 確認 TypeScript 編不壞**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 沒有因為這個改動新增的錯誤（既有寫入 `users` 的地方因為 `email` 是必填可能報錯 → 下一步處理）。

- [ ] **Step 3: 既有 user 寫入補 email 欄位**

`src/app/parent/(tabs)/family.tsx:184` 的 `handleAddChild` 建 child user doc 補 `email: null`（小孩真帳號在 Plan B 才做，這裡先補欄位讓型別過）：
在 `roleType: 'child',` 後加一行 `email: null,`。

- [ ] **Step 4: 再次型別檢查**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/types/models.ts src/app/parent/\(tabs\)/family.tsx
git commit -m "feat(model): User 加 email 欄位與 password 登入方式"
```

---

## Section 2：bootstrapParentAccount callable

### Task 2.1：建 `bootstrapParentAccount` 並 TDD

**Files:**
- Create: `functions/src/bootstrapParentAccount.ts`
- Create: `functions/src/__tests__/bootstrapParentAccount.test.ts`
- Modify: `functions/src/index.ts`

合約：已登入家長（client 先 `createUserWithEmailAndPassword`）呼叫 `bootstrapParentAccount({ displayName, familyName })`。函式在 transaction 內：建 `users/{uid}`(parent, email 取自 auth token)、建 `families/{familyId}`、建 `familyMemberships/{uid}_{familyId}`(parent, active)。冪等：若 `users/{uid}` 已存在且為 parent，不重複建 family，直接回傳既有 familyId。回傳 `{ familyId }`。

- [ ] **Step 1: 寫失敗測試**

Create `functions/src/__tests__/bootstrapParentAccount.test.ts`:
```typescript
import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { bootstrapParentAccount } from '../bootstrapParentAccount';

const fft = functionsTest({ projectId: 'mission-for-kids' });

function wrap() {
  return fft.wrap(bootstrapParentAccount);
}

afterAll(() => fft.cleanup());

describe('bootstrapParentAccount', () => {
  it('建立 parent user doc + family + 家長 membership 並回傳 familyId', async () => {
    const uid = 'parent-uid-1';
    const res: any = await wrap()({
      data: { displayName: '媽媽', familyName: '我們家' },
      auth: { uid, token: { email: 'mom@example.com' } },
    } as any);

    expect(res.familyId).toBeTruthy();

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    expect(userDoc.data()).toMatchObject({
      roleType: 'parent',
      displayName: '媽媽',
      email: 'mom@example.com',
      authProvider: 'password',
    });

    const famDoc = await db.collection('families').doc(res.familyId).get();
    expect(famDoc.data()).toMatchObject({ displayName: '我們家', createdBy: uid });

    const memDoc = await db
      .collection('familyMemberships')
      .doc(`${uid}_${res.familyId}`)
      .get();
    expect(memDoc.data()).toMatchObject({
      userId: uid,
      role: 'parent',
      status: 'active',
      familyId: res.familyId,
    });
  });

  it('未登入時丟 unauthenticated', async () => {
    await expect(
      wrap()({ data: { displayName: 'x', familyName: 'y' } } as any)
    ).rejects.toThrow(/unauthenticated/i);
  });

  it('冪等：同一個 parent 再呼叫不會建第二個 family', async () => {
    const uid = 'parent-uid-2';
    const first: any = await wrap()({
      data: { displayName: '爸爸', familyName: '家一' },
      auth: { uid, token: { email: 'dad@example.com' } },
    } as any);
    const second: any = await wrap()({
      data: { displayName: '爸爸', familyName: '家二' },
      auth: { uid, token: { email: 'dad@example.com' } },
    } as any);
    expect(second.familyId).toBe(first.familyId);

    const db = admin.firestore();
    const fams = await db.collection('families').where('createdBy', '==', uid).get();
    expect(fams.size).toBe(1);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd functions && npm test -- bootstrapParentAccount`
Expected: FAIL（`Cannot find module '../bootstrapParentAccount'`）。

- [ ] **Step 3: 實作 `functions/src/bootstrapParentAccount.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const bootstrapParentAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', '必須先登入');
  }
  const displayName = String(request.data?.displayName ?? '').trim();
  const familyName = String(request.data?.familyName ?? '').trim();
  if (!displayName || !familyName) {
    throw new HttpsError('invalid-argument', 'displayName 與 familyName 必填');
  }
  const email = (request.auth?.token?.email as string | undefined) ?? null;
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async (tx) => {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await tx.get(userRef);

    // 冪等：已是 parent 且已有 family → 直接回傳
    if (userSnap.exists && userSnap.data()?.roleType === 'parent') {
      const existing = await db
        .collection('familyMemberships')
        .where('userId', '==', uid)
        .where('role', '==', 'parent')
        .where('status', '==', 'active')
        .limit(1)
        .get();
      if (!existing.empty) {
        return { familyId: existing.docs[0].data().familyId as string };
      }
    }

    const familyRef = db.collection('families').doc();
    tx.set(userRef, {
      displayName,
      avatarUrl: null,
      authProvider: 'password',
      authProviderId: uid,
      roleType: 'parent',
      email,
      birthday: null,
      createdAt: now,
    });
    tx.set(familyRef, {
      displayName: familyName,
      defaultGraceDays: 2,
      createdBy: uid,
      createdAt: now,
    });
    tx.set(db.collection('familyMemberships').doc(`${uid}_${familyRef.id}`), {
      familyId: familyRef.id,
      userId: uid,
      role: 'parent',
      status: 'active',
      invitedBy: uid,
      joinedAt: now,
    });
    return { familyId: familyRef.id };
  });
});
```

- [ ] **Step 4: 匯出 function**

`functions/src/index.ts` 加一行：
```typescript
export { bootstrapParentAccount } from './bootstrapParentAccount';
```

- [ ] **Step 5: 跑測試確認通過**

Run: `cd functions && npm test -- bootstrapParentAccount`
Expected: PASS（3 個測試全過）。

- [ ] **Step 6: Commit**

```bash
cd .. && git add functions/src/bootstrapParentAccount.ts functions/src/__tests__/bootstrapParentAccount.test.ts functions/src/index.ts
git commit -m "feat(functions): bootstrapParentAccount — 建家長帳號+家庭(transaction+冪等)"
```

---

## Section 3：client 註冊封裝 + sign-in UI

### Task 3.1：`registerParent` client 封裝並 TDD

**Files:**
- Create: `src/lib/auth/registerParent.ts`
- Create: `src/lib/auth/__tests__/registerParent.test.ts`

合約：`registerParent({ email, password, displayName, familyName })` → `auth().createUserWithEmailAndPassword` → 呼叫 callable `bootstrapParentAccount` → 回傳 `{ familyId }`。

- [ ] **Step 1: 寫失敗測試**

Create `src/lib/auth/__tests__/registerParent.test.ts`:
```typescript
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';
import { registerParent } from '../registerParent';

describe('registerParent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('先建 auth 帳號再呼叫 bootstrapParentAccount，回傳 familyId', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    createUser.mockResolvedValue({ user: { uid: 'new-uid' } });

    const callable = jest.fn(async () => ({ data: { familyId: 'fam-123' } }));
    (functions as any).__mocks.httpsCallable.mockReturnValue(callable);

    const res = await registerParent({
      email: 'mom@example.com',
      password: 'secret123',
      displayName: '媽媽',
      familyName: '我們家',
    });

    expect(createUser).toHaveBeenCalledWith('mom@example.com', 'secret123');
    expect((functions as any).__mocks.httpsCallable).toHaveBeenCalledWith(
      'bootstrapParentAccount'
    );
    expect(callable).toHaveBeenCalledWith({ displayName: '媽媽', familyName: '我們家' });
    expect(res).toEqual({ familyId: 'fam-123' });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- registerParent`
Expected: FAIL（找不到 `../registerParent`）。

- [ ] **Step 3: 實作 `src/lib/auth/registerParent.ts`**

```typescript
import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export interface RegisterParentInput {
  email: string;
  password: string;
  displayName: string;
  familyName: string;
}

export async function registerParent(
  input: RegisterParentInput
): Promise<{ familyId: string }> {
  await auth().createUserWithEmailAndPassword(input.email, input.password);
  const fn = functions().httpsCallable('bootstrapParentAccount');
  const res = await fn({
    displayName: input.displayName,
    familyName: input.familyName,
  });
  return { familyId: (res.data as { familyId: string }).familyId };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- registerParent`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/registerParent.ts src/lib/auth/__tests__/registerParent.test.ts
git commit -m "feat(auth): registerParent client 封裝 (signup + bootstrap)"
```

### Task 3.2：sign-in 畫面加 email/密碼 註冊 + 登入

**Files:**
- Modify: `src/app/auth/sign-in.tsx`

- [ ] **Step 1: 在 `sign-in.tsx` 加 email/密碼 登入 handler**

在既有 `handleJoinWithCode` 附近加入（沿用 `useState` 已 import）。先在元件頂部加狀態：
```typescript
const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [displayName, setDisplayName] = useState('');
const [familyName, setFamilyName] = useState('');
```
加 handler：
```typescript
const handleEmailSignIn = async () => {
  if (!email.trim() || !password) return;
  try {
    setLoading(true);
    await auth().signInWithEmailAndPassword(email.trim(), password);
    router.replace('/');
  } catch (e: any) {
    Alert.alert(t('common.error'), e?.message ?? '登入失敗');
  } finally {
    setLoading(false);
  }
};

const handleEmailSignUp = async () => {
  if (!email.trim() || !password || !displayName.trim() || !familyName.trim()) return;
  try {
    setLoading(true);
    const { registerParent } = await import('../../lib/auth/registerParent');
    await registerParent({
      email: email.trim(),
      password,
      displayName: displayName.trim(),
      familyName: familyName.trim(),
    });
    router.replace('/');
  } catch (e: any) {
    Alert.alert(t('common.error'), e?.message ?? '註冊失敗');
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 2: 加 UI（email/密碼欄位 + 切換 signin/signup + 送出鈕）**

在 `return` 的 JSX 中、現有 Google/Apple 按鈕區塊上方插入一段表單。最小可用版本：
```tsx
<View style={{ gap: spacing.sm, width: '100%' }}>
  <TextInput
    testID="email-input"
    placeholder="Email"
    autoCapitalize="none"
    keyboardType="email-address"
    value={email}
    onChangeText={setEmail}
    style={styles.input}
  />
  <TextInput
    testID="password-input"
    placeholder="密碼"
    secureTextEntry
    value={password}
    onChangeText={setPassword}
    style={styles.input}
  />
  {authMode === 'signup' && (
    <>
      <TextInput
        testID="displayname-input"
        placeholder="你的暱稱"
        value={displayName}
        onChangeText={setDisplayName}
        style={styles.input}
      />
      <TextInput
        testID="familyname-input"
        placeholder="家庭名稱"
        value={familyName}
        onChangeText={setFamilyName}
        style={styles.input}
      />
    </>
  )}
  <Pressable
    testID="email-submit"
    onPress={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
    style={styles.primaryBtn}
  >
    <AppText>{authMode === 'signin' ? '登入' : '註冊並建立家庭'}</AppText>
  </Pressable>
  <Pressable
    testID="toggle-auth-mode"
    onPress={() => setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
  >
    <BodySm>{authMode === 'signin' ? '沒有帳號？註冊' : '已有帳號？登入'}</BodySm>
  </Pressable>
</View>
```
若 `styles.input` / `styles.primaryBtn` 不存在，於 `StyleSheet.create` 補：
```typescript
input: {
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderRadius: radius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  color: '#fff',
},
primaryBtn: {
  backgroundColor: P.primary,
  borderRadius: radius.md,
  paddingVertical: spacing.md,
  alignItems: 'center',
},
```

- [ ] **Step 3: 寫元件測試**

Create `src/app/auth/__tests__/sign-in.test.tsx`:
```tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import auth from '@react-native-firebase/auth';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import SignIn from '../sign-in';

describe('SignIn email/密碼', () => {
  beforeEach(() => jest.clearAllMocks());

  it('登入模式：填 email/密碼送出會呼叫 signInWithEmailAndPassword', async () => {
    const signIn = (auth as any).__mocks.signInWithEmailAndPassword;
    signIn.mockResolvedValue({ user: { uid: 'u1' } });

    const { getByTestId } = render(<SignIn />);
    fireEvent.changeText(getByTestId('email-input'), 'mom@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'secret123');
    fireEvent.press(getByTestId('email-submit'));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('mom@example.com', 'secret123')
    );
  });

  it('可切換到註冊模式並顯示家庭名稱欄位', () => {
    const { getByTestId, queryByTestId } = render(<SignIn />);
    expect(queryByTestId('familyname-input')).toBeNull();
    fireEvent.press(getByTestId('toggle-auth-mode'));
    expect(getByTestId('familyname-input')).toBeTruthy();
  });
});
```

- [ ] **Step 4: 跑測試**

Run: `npm test -- sign-in`
Expected: PASS（2 個測試）。若因 `Starfield` / design import 在測試環境報錯，於測試檔頂部加 `jest.mock('../../../design/Starfield', () => ({ Starfield: () => null }));`。

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/sign-in.tsx src/app/auth/__tests__/sign-in.test.tsx
git commit -m "feat(auth): sign-in 加 email/密碼 登入與家長註冊 UI"
```

---

## Section 4：路由處理「已登入但無 profile」

### Task 4.1：index 路由補 authed-no-profile 狀態

**Files:**
- Modify: `src/app/index.tsx`

問題：使用者剛 `createUserWithEmailAndPassword` 後、`bootstrapParentAccount` 還沒跑完或失敗時，`useAuth` 的 `user` 會是 null 但 `firebaseUser` 不為 null。現行邏輯會把這種人導回 sign-in（無限迴圈風險）。

- [ ] **Step 1: 寫失敗測試**

Create `src/app/__tests__/index.test.tsx`:
```tsx
import React from 'react';
import { render } from '@testing-library/react-native';

const replace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace }) }));

const mockAuthState = { firebaseUser: null as any, user: null as any, loading: false };
jest.mock('../hooks/useAuth', () => ({ useAuth: () => mockAuthState }));

import Index from '../index';

describe('Index 路由', () => {
  beforeEach(() => {
    replace.mockClear();
    mockAuthState.firebaseUser = null;
    mockAuthState.user = null;
    mockAuthState.loading = false;
  });

  it('已登入(firebaseUser)但還沒 profile → 不導回 sign-in', () => {
    mockAuthState.firebaseUser = { uid: 'u1' };
    mockAuthState.user = null;
    render(<Index />);
    expect(replace).not.toHaveBeenCalledWith('/auth/sign-in');
  });

  it('完全沒登入 → 導去 sign-in', () => {
    render(<Index />);
    expect(replace).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('parent → 導去家長頁', () => {
    mockAuthState.firebaseUser = { uid: 'u1' };
    mockAuthState.user = { roleType: 'parent' };
    render(<Index />);
    expect(replace).toHaveBeenCalledWith('/parent/(tabs)/tasks');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm test -- "app/__tests__/index"`
Expected: FAIL（第一個測試會失敗，因為現行碼在 user=null 時就 replace 到 sign-in）。

- [ ] **Step 3: 改 `src/app/index.tsx` 的 effect**

把 `useEffect` 內邏輯改成：
```typescript
useEffect(() => {
  if (loading) return;

  if (!firebaseUser) {
    router.replace('/auth/sign-in');
  } else if (!user) {
    // 已登入但 profile 還沒建好（bootstrap 進行中/失敗）— 停在 loading，不彈回 sign-in
    return;
  } else if (user.roleType === 'parent') {
    router.replace('/parent/(tabs)/tasks');
  } else {
    router.replace('/child/(tabs)/tasks');
  }
}, [firebaseUser, user, loading]);
```
記得從 `useAuth()` 取出 `firebaseUser`：把 `const { user, loading } = useAuth();` 改成 `const { firebaseUser, user, loading } = useAuth();`。

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test -- "app/__tests__/index"`
Expected: PASS（3 個測試）。

- [ ] **Step 5: Commit**

```bash
git add src/app/index.tsx src/app/__tests__/index.test.tsx
git commit -m "fix(routing): 已登入但無 profile 時停在 loading 不彈回 sign-in"
```

---

## Self-Review（規劃者自查，已完成）

**1. Spec 覆蓋（Plan A 範圍）：**
- 測試基建（Functions + RN）→ Task 0.1–0.3 ✅
- email/密碼 家長帳號 → Task 2.1（後端）+ 3.1/3.2（client/UI）✅
- 建家庭 → Task 2.1（bootstrapParentAccount 內建 family + membership）✅
- 資料模型（User.email/password provider）→ Task 1.1 ✅
- Firebase 啟用 Email/Password → 列為人工前置（emulator 測試不需）✅
- （childId 點數重構、email 邀請、dev seed、清測試資料 → 屬 Plan B/C/D，不在 A）

**2. Placeholder 掃描：** 無 TBD/TODO；每個 code step 都有完整程式碼與預期輸出。

**3. 型別一致性：** `bootstrapParentAccount({ displayName, familyName })` 在後端 onCall、client `registerParent`、UI 呼叫三處一致；回傳 `{ familyId }` 一致；`User` 新欄位 `email`/`'password'` 在 type 與後端寫入一致。

**已知後續（非本計畫）：** Plan B 會新增 `childId`、`FamilyInvite` 型別與小孩端；屆時 `registerParent` 的 mock 與真機驗證流程沿用本計畫建立的測試基建。
