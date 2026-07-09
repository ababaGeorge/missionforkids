import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'ord-1' }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
}));
jest.mock('../../../../design/Starfield', () => ({ Starfield: () => null }));
// design/Text 透過 fonts.ts 載入 @expo-google-fonts/*（未轉譯的 ESM，jest 會炸）。
// 用簡單的 Text 元件取代（同 sign-in.test.tsx 的做法）。
jest.mock('../../../../design/Text', () => {
  const { Text } = require('react-native');
  const Comp = ({ children, ...props }: any) => <Text {...props}>{children}</Text>;
  return {
    AppText: Comp,
    Display: Comp,
    H3: Comp,
    Body: Comp,
    BodySm: Comp,
    Label: Comp,
    Muted: Comp,
    Data: Comp,
  };
});
// firestore：捕捉 onSnapshot 的 next/error callback，讓測試能模擬
// 「訂單不存在 / 權限錯誤 / 內嵌 item get 失敗」三種情境。
jest.mock('@react-native-firebase/firestore', () => {
  const onSnapshot = jest.fn(() => jest.fn());
  const get = jest.fn();
  const doc = jest.fn(() => ({ onSnapshot, get }));
  const collection = jest.fn(() => ({ doc }));
  const firestoreMock: any = () => ({ collection });
  firestoreMock.FieldValue = { serverTimestamp: jest.fn(), increment: jest.fn() };
  firestoreMock.__mocks = { onSnapshot, get };
  return { __esModule: true, default: firestoreMock };
});

import firestore from '@react-native-firebase/firestore';
import ChildOrderDetail from '../[id]';

const fsMocks = (firestore as any).__mocks;

const lastSnapshotCallbacks = () => {
  const calls = fsMocks.onSnapshot.mock.calls;
  const [next, onError] = calls[calls.length - 1];
  return { next, onError };
};

describe('ChildOrderDetail 讀取失敗出口（R2-18）', () => {
  beforeEach(() => jest.clearAllMocks());

  it('訂單文件不存在 → 顯示「找不到」而非永久卡在載入畫面', async () => {
    const { getByText } = render(<ChildOrderDetail />);
    const { next } = lastSnapshotCallbacks();
    await act(async () => {
      await next({ id: 'ord-1', data: () => undefined });
    });
    expect(getByText('找不到這筆訂單')).toBeTruthy();
  });

  it('onSnapshot 回報錯誤（權限/網路）→ 顯示「找不到」', async () => {
    const { getByText } = render(<ChildOrderDetail />);
    const { onError } = lastSnapshotCallbacks();
    await act(async () => {
      onError(new Error('firestore/permission-denied'));
    });
    expect(getByText('找不到這筆訂單')).toBeTruthy();
  });

  it('內嵌 item get 失敗 → 顯示「找不到」', async () => {
    fsMocks.get.mockRejectedValue(new Error('network'));
    const { getByText } = render(<ChildOrderDetail />);
    const { next } = lastSnapshotCallbacks();
    await act(async () => {
      await next({
        id: 'ord-1',
        data: () => ({ itemId: 'r1', status: 'pending' }),
      });
    });
    expect(getByText('找不到這筆訂單')).toBeTruthy();
  });

  it('正常讀取 → 顯示訂單內容，不顯示「找不到」', async () => {
    fsMocks.get.mockResolvedValue({
      id: 'r1',
      data: () => ({ title: '冰淇淋', pointCost: 10 }),
    });
    const { getByText, queryByText } = render(<ChildOrderDetail />);
    const { next } = lastSnapshotCallbacks();
    await act(async () => {
      await next({
        id: 'ord-1',
        data: () => ({ itemId: 'r1', status: 'pending', pointCostSnapshot: 10 }),
      });
    });
    expect(getByText('冰淇淋')).toBeTruthy();
    expect(queryByText('找不到這筆訂單')).toBeNull();
  });
});
