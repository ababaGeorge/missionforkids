import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';

jest.mock('../../design/Starfield', () => ({ Starfield: () => null }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockSignOut = jest.fn(async () => {});
const mockAuthState = {
  firebaseUser: null as any,
  user: null as any,
  loading: false,
  signOut: mockSignOut,
};
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => mockAuthState }));

import Index from '../index';

describe('Index 路由', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockSignOut.mockClear();
    mockAuthState.firebaseUser = null;
    mockAuthState.user = null;
    mockAuthState.loading = false;
  });

  it('已登入(firebaseUser)但還沒 profile → 不導回 sign-in', () => {
    mockAuthState.firebaseUser = { uid: 'u1' };
    mockAuthState.user = null;
    render(<Index />);
    expect(mockReplace).not.toHaveBeenCalledWith('/auth/sign-in');
  });

  it('完全沒登入 → 導去 sign-in', () => {
    render(<Index />);
    expect(mockReplace).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('parent → 導去家長頁', () => {
    mockAuthState.firebaseUser = { uid: 'u1' };
    mockAuthState.user = { roleType: 'parent' };
    render(<Index />);
    expect(mockReplace).toHaveBeenCalledWith('/parent/(tabs)/tasks');
  });

  it('stuck 8 秒後出現重新登入按鈕，按下 → signOut 並回 sign-in', async () => {
    jest.useFakeTimers();
    try {
      mockAuthState.firebaseUser = { uid: 'u1' };
      mockAuthState.user = null;
      const { queryByText, getByText } = render(<Index />);

      // 8 秒前不顯示逃生出口
      act(() => { jest.advanceTimersByTime(7999); });
      expect(queryByText('重新登入')).toBeNull();

      act(() => { jest.advanceTimersByTime(1); });
      expect(getByText('重新登入')).toBeTruthy();

      fireEvent.press(getByText('重新登入'));
      await act(async () => {}); // flush signOut promise
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/auth/sign-in');
    } finally {
      jest.useRealTimers();
    }
  });

  it('profile 到了 → 不顯示逃生出口', () => {
    jest.useFakeTimers();
    try {
      mockAuthState.firebaseUser = { uid: 'u1' };
      mockAuthState.user = { roleType: 'child' };
      const { queryByText } = render(<Index />);
      act(() => { jest.advanceTimersByTime(10000); });
      expect(queryByText('重新登入')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
