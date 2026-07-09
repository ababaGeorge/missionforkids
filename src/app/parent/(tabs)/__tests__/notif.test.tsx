import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
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
jest.mock('../../../../hooks/useFamily', () => ({
  useFamily: () => ({ family: { id: 'fam-1' } }),
}));
jest.mock('../../../../lib/memberName', () => ({
  resolveMemberDisplay: jest.fn(async () => ({ name: '小明' })),
}));
// firestore：按 collection 名稱記下各訂閱的 next callback，
// 讓測試能分別注入「待審任務」與「待審訂單」快照。
jest.mock('@react-native-firebase/firestore', () => {
  const handlers: Record<string, { next: any; onError: any }> = {};
  const docGet = jest.fn();
  const collection = jest.fn((name: string) => {
    const query: any = {};
    query.where = jest.fn(() => query);
    query.onSnapshot = jest.fn((next: any, onError: any) => {
      handlers[name] = { next, onError };
      return jest.fn();
    });
    query.doc = jest.fn(() => ({ get: docGet }));
    return query;
  });
  const firestoreMock: any = () => ({ collection });
  firestoreMock.__mocks = { handlers, docGet };
  return { __esModule: true, default: firestoreMock };
});

import firestore from '@react-native-firebase/firestore';
import ParentNotif from '../notif';

const fsMocks = (firestore as any).__mocks;

describe('ParentNotif 點擊通知導覽到審核頁（R2-15a）', () => {
  beforeEach(() => {
    mockPush.mockClear();
    fsMocks.docGet.mockReset();
  });

  it('點擊任務通知 → 導覽到家長審核頁', async () => {
    fsMocks.docGet.mockResolvedValue({ data: () => ({ title: '刷牙', points: 5 }) });
    const { getByText } = render(<ParentNotif />);
    await act(async () => {
      await fsMocks.handlers['taskInstances'].next({
        docs: [
          {
            id: 'ti-1',
            data: () => ({ taskId: 't1', userId: 'c1', submittedAt: null, periodEnd: null }),
          },
        ],
      });
    });
    fireEvent.press(getByText('小明 完成了「刷牙」'));
    expect(mockPush).toHaveBeenCalledWith('/parent/(tabs)/review');
  });

  it('點擊兌換訂單通知 → 導覽到家長審核頁', async () => {
    fsMocks.docGet.mockResolvedValue({ data: () => ({ title: '冰淇淋' }) });
    const { getByText } = render(<ParentNotif />);
    await act(async () => {
      await fsMocks.handlers['rewardOrders'].next({
        docs: [
          {
            id: 'ord-1',
            data: () => ({ itemId: 'r1', userId: 'c1', pointCostSnapshot: 10, createdAt: null }),
          },
        ],
      });
    });
    fireEvent.press(getByText('小明 想兌換「冰淇淋」'));
    expect(mockPush).toHaveBeenCalledWith('/parent/(tabs)/review');
  });
});
