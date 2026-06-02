import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../design/Starfield', () => ({ Starfield: () => null }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockAuthState = { firebaseUser: null as any, user: null as any, loading: false };
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => mockAuthState }));

import Index from '../index';

describe('Index 路由', () => {
  beforeEach(() => {
    mockReplace.mockClear();
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
});
