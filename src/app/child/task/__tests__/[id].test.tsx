import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'inst-1' }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
}));
jest.mock('../../../../design/Starfield', () => ({ Starfield: () => null }));
jest.mock('../../../../design/RoughStar', () => ({ RoughStar: () => null }));
// design/Text 透過 fonts.ts 載入 @expo-google-fonts/*（未轉譯的 ESM，jest 會炸）。
// 用簡單的 Text 元件取代（同 sign-in.test.tsx 的做法）。
jest.mock('../../../../design/Text', () => {
  const { Text } = require('react-native');
  const Comp = ({ children, ...props }: any) => <Text {...props}>{children}</Text>;
  return {
    AppText: Comp,
    Display: Comp,
    H2: Comp,
    H3: Comp,
    Body: Comp,
    BodySm: Comp,
    Label: Comp,
    Muted: Comp,
    Data: Comp,
  };
});
jest.mock('../../../../lib/photoUpload', () => ({
  pickPhoto: jest.fn(),
  uploadPhoto: jest.fn(),
}));
jest.mock('../../../../lib/childId', () => ({
  resolveMyChildId: jest.fn(async () => 'c1'),
  walletDocId: (familyId: string, childId: string) => `${familyId}_${childId}`,
}));
// firestore：捕捉 onSnapshot 的 next/error callback，讓測試能模擬
// 「文件不存在 / 權限錯誤 / 內嵌 task get 失敗」三種情境。
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
import ChildTaskDetail from '../[id]';

const fsMocks = (firestore as any).__mocks;

const lastSnapshotCallbacks = () => {
  const calls = fsMocks.onSnapshot.mock.calls;
  const [next, onError] = calls[calls.length - 1];
  return { next, onError };
};

describe('ChildTaskDetail 讀取失敗出口（R2-18）', () => {
  beforeEach(() => jest.clearAllMocks());

  it('instance 文件不存在 → 顯示「找不到」而非永久轉圈', async () => {
    const { getByText } = render(<ChildTaskDetail />);
    const { next } = lastSnapshotCallbacks();
    await act(async () => {
      await next({ id: 'inst-1', data: () => undefined });
    });
    expect(getByText('找不到這個任務')).toBeTruthy();
  });

  it('onSnapshot 回報錯誤（權限/網路）→ 顯示「找不到」', async () => {
    const { getByText } = render(<ChildTaskDetail />);
    const { onError } = lastSnapshotCallbacks();
    await act(async () => {
      onError(new Error('firestore/permission-denied'));
    });
    expect(getByText('找不到這個任務')).toBeTruthy();
  });

  it('內嵌 task get 失敗 → 顯示「找不到」', async () => {
    fsMocks.get.mockRejectedValue(new Error('network'));
    const { getByText } = render(<ChildTaskDetail />);
    const { next } = lastSnapshotCallbacks();
    await act(async () => {
      await next({
        id: 'inst-1',
        data: () => ({ taskId: 't1', familyId: 'f1', status: 'pending' }),
      });
    });
    expect(getByText('找不到這個任務')).toBeTruthy();
  });

  it('task 文件不存在（tData 空）→ 顯示「找不到」', async () => {
    fsMocks.get.mockResolvedValue({ id: 't1', data: () => undefined });
    const { getByText } = render(<ChildTaskDetail />);
    const { next } = lastSnapshotCallbacks();
    await act(async () => {
      await next({
        id: 'inst-1',
        data: () => ({ taskId: 't1', familyId: 'f1', status: 'pending' }),
      });
    });
    expect(getByText('找不到這個任務')).toBeTruthy();
  });

  it('正常讀取 → 顯示任務內容，不顯示「找不到」', async () => {
    fsMocks.get.mockResolvedValue({
      id: 't1',
      data: () => ({ title: '刷牙', points: 5, frequency: 'daily', familyId: 'f1' }),
    });
    const { getByText, queryByText } = render(<ChildTaskDetail />);
    const { next } = lastSnapshotCallbacks();
    await act(async () => {
      await next({
        id: 'inst-1',
        data: () => ({ taskId: 't1', familyId: 'f1', status: 'pending', submissionCount: 0 }),
      });
    });
    expect(getByText('刷牙')).toBeTruthy();
    expect(queryByText('找不到這個任務')).toBeNull();
  });
});
