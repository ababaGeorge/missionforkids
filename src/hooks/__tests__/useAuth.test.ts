import { renderHook, act } from '@testing-library/react-native';

// ---- @react-native-firebase/auth mock：可手動觸發 onAuthStateChanged ----
const mockAuthEnv: {
  callback: ((u: any) => void) | null;
  unsubAuth: jest.Mock;
  signOut: jest.Mock;
} = {
  callback: null,
  unsubAuth: jest.fn(),
  signOut: jest.fn(async () => {}),
};

jest.mock('@react-native-firebase/auth', () => {
  const authMock = () => ({
    onAuthStateChanged: (cb: any) => {
      mockAuthEnv.callback = cb;
      return mockAuthEnv.unsubAuth;
    },
    signOut: mockAuthEnv.signOut,
    currentUser: null,
  });
  return { __esModule: true, default: authMock };
});

// ---- @react-native-firebase/firestore mock：可手動觸發 users/{uid} snapshot ----
type SnapListener = {
  onNext: (snap: any) => void | Promise<void>;
  onError: (err: any) => void;
  unsub: jest.Mock;
};
const mockFsEnv: {
  listeners: Record<string, SnapListener[]>;
  queryResult: { empty: boolean; docs: any[] };
  queryGet: jest.Mock;
} = {
  listeners: {},
  queryResult: { empty: true, docs: [] },
  queryGet: jest.fn(async () => mockFsEnv.queryResult),
};

jest.mock('@react-native-firebase/firestore', () => {
  const firestoreMock = () => ({
    collection: () => ({
      doc: (id: string) => ({
        onSnapshot: (onNext: any, onError: any) => {
          const unsub = jest.fn();
          (mockFsEnv.listeners[id] = mockFsEnv.listeners[id] ?? []).push({ onNext, onError, unsub });
          return unsub;
        },
      }),
      where: () => ({ limit: () => ({ get: mockFsEnv.queryGet }) }),
    }),
  });
  return { __esModule: true, default: firestoreMock };
});

import { useAuth } from '../useAuth';

// users/{uid} 的 DocumentSnapshot 假物件（v24 的 exists 是方法）
const docSnap = (id: string, data: Record<string, any> | null) => ({
  id,
  exists: () => data !== null,
  data: () => data,
});

describe('useAuth（onSnapshot 監聽＋世代守衛）', () => {
  beforeEach(() => {
    mockAuthEnv.callback = null;
    mockAuthEnv.unsubAuth.mockClear();
    mockAuthEnv.signOut.mockClear();
    mockFsEnv.listeners = {};
    mockFsEnv.queryResult = { empty: true, docs: [] };
    mockFsEnv.queryGet.mockClear();
  });

  it('doc 晚建自動解鎖：snapshot 先空後有 → user 自動補上', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);

    await act(async () => { mockAuthEnv.callback!({ uid: 'u1' }); });
    const listener = mockFsEnv.listeners['u1'][0];

    // 第一次 snapshot：doc 還沒建（fallback 查詢也空）→ 解除 loading 但 user=null
    await act(async () => { await listener.onNext(docSnap('u1', null)); });
    expect(result.current.loading).toBe(false);
    expect(result.current.firebaseUser).toEqual({ uid: 'u1' });
    expect(result.current.user).toBeNull();

    // CF 補建 doc → 第二次 snapshot 自動解鎖
    await act(async () => { await listener.onNext(docSnap('u1', { roleType: 'parent' })); });
    expect(result.current.user).toMatchObject({ id: 'u1', roleType: 'parent' });
  });

  it('fallback：doc ID ≠ uid 的舊小孩帳號用 authProviderId 查到', async () => {
    mockFsEnv.queryResult = {
      empty: false,
      docs: [{ id: 'child-legacy', data: () => ({ roleType: 'child' }) }],
    };
    const { result } = renderHook(() => useAuth());
    await act(async () => { mockAuthEnv.callback!({ uid: 'u1' }); });
    await act(async () => { await mockFsEnv.listeners['u1'][0].onNext(docSnap('u1', null)); });
    expect(result.current.user).toMatchObject({ id: 'child-legacy', roleType: 'child' });
    expect(result.current.loading).toBe(false);
  });

  it('同世代競態：fallback 查詢進行中 doc 補建 → 過期空結果不把 user 蓋回 null', async () => {
    // 慢網路情境：第一次 snapshot（doc 空）觸發的 fallback 查詢還在飛，
    // CF 補建 doc 的第二次 snapshot 已把 user 設好；過期查詢回來必須作廢。
    let resolveQuery!: (v: { empty: boolean; docs: any[] }) => void;
    mockFsEnv.queryGet.mockImplementationOnce(
      () => new Promise((resolve) => { resolveQuery = resolve; })
    );
    const { result } = renderHook(() => useAuth());
    await act(async () => { mockAuthEnv.callback!({ uid: 'u1' }); });
    const listener = mockFsEnv.listeners['u1'][0];

    // 第一次 snapshot：doc 空 → onNext 掛在 await fallback 查詢上
    let firstOnNext!: Promise<void>;
    await act(async () => {
      firstOnNext = Promise.resolve(listener.onNext(docSnap('u1', null)));
    });

    // CF 補建 doc → 第二次 snapshot 設好 user
    await act(async () => { await listener.onNext(docSnap('u1', { roleType: 'parent' })); });
    expect(result.current.user).toMatchObject({ id: 'u1', roleType: 'parent' });

    // 過期 fallback 這時才回來（空結果）→ 不得把已載入的 user 蓋回 null
    await act(async () => {
      resolveQuery({ empty: true, docs: [] });
      await firstOnNext;
    });
    expect(result.current.user).toMatchObject({ id: 'u1', roleType: 'parent' });
    expect(result.current.loading).toBe(false);
  });

  it('世代守衛：換帳號後，舊帳號遲到的 snapshot 不污染新 state', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { mockAuthEnv.callback!({ uid: 'u1' }); });
    const l1 = mockFsEnv.listeners['u1'][0];

    // 換帳號 → 舊 user doc listener 被解除
    await act(async () => { mockAuthEnv.callback!({ uid: 'u2' }); });
    expect(l1.unsub).toHaveBeenCalled();

    // 新帳號 snapshot 先到
    await act(async () => {
      await mockFsEnv.listeners['u2'][0].onNext(docSnap('u2', { roleType: 'parent' }));
    });
    expect(result.current.user).toMatchObject({ id: 'u2' });

    // 舊帳號 snapshot 遲到 → 作廢，不覆寫
    await act(async () => { await l1.onNext(docSnap('u1', { roleType: 'child' })); });
    expect(result.current.user).toMatchObject({ id: 'u2', roleType: 'parent' });
    expect(result.current.firebaseUser).toEqual({ uid: 'u2' });
  });

  it('登出：清空 state 並解除 user doc 監聽', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { mockAuthEnv.callback!({ uid: 'u1' }); });
    const l1 = mockFsEnv.listeners['u1'][0];
    await act(async () => { await l1.onNext(docSnap('u1', { roleType: 'parent' })); });
    expect(result.current.user).not.toBeNull();

    await act(async () => { mockAuthEnv.callback!(null); });
    expect(l1.unsub).toHaveBeenCalled();
    expect(result.current.firebaseUser).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('snapshot 錯誤：解除 loading（user=null），不讓畫面卡死', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { result } = renderHook(() => useAuth());
      await act(async () => { mockAuthEnv.callback!({ uid: 'u1' }); });
      await act(async () => { mockFsEnv.listeners['u1'][0].onError({ code: 'firestore/unavailable' }); });
      expect(result.current.loading).toBe(false);
      expect(result.current.firebaseUser).toEqual({ uid: 'u1' });
      expect(result.current.user).toBeNull();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('unmount：解除 auth 與 user doc 兩個監聽', async () => {
    const { unmount } = renderHook(() => useAuth());
    await act(async () => { mockAuthEnv.callback!({ uid: 'u1' }); });
    const l1 = mockFsEnv.listeners['u1'][0];
    unmount();
    expect(l1.unsub).toHaveBeenCalled();
    expect(mockAuthEnv.unsubAuth).toHaveBeenCalled();
  });
});
