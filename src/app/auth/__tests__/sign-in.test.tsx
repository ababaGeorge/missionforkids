import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import auth from '@react-native-firebase/auth';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

// firestore 沒有全域 mock，但 sign-in.tsx 在 module 頂層 import 它（native module 在
// 測試環境不存在會直接 throw）。本測試只驗 email/密碼 流程，不碰 firestore，給個空 stub 即可。
jest.mock('@react-native-firebase/firestore', () => {
  const firestoreMock: any = () => ({});
  firestoreMock.Timestamp = { now: jest.fn(), fromDate: jest.fn() };
  firestoreMock.FieldValue = { serverTimestamp: jest.fn() };
  return { __esModule: true, default: firestoreMock };
});
jest.mock('../../../design/Starfield', () => ({ Starfield: () => null }));
// 註冊流程走 registerParent（元件內動態 import），mock 掉以驗證 CF 錯誤映射。
jest.mock('../../../lib/auth/registerParent', () => ({ registerParent: jest.fn() }));
// design/Text 透過 fonts.ts 載入 @expo-google-fonts/*（未轉譯的 ESM，jest 會炸）。
// 用簡單的 Text 元件取代，行為對本測試足夠（只需渲染出文字節點）。
jest.mock('../../../design/Text', () => {
  const { Text } = require('react-native');
  const Comp = ({ children, ...props }: any) => <Text {...props}>{children}</Text>;
  return { AppText: Comp, Display: Comp, BodySm: Comp, Label: Comp };
});

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

  it('註冊模式：CF 拋 ALREADY_CHILD → 顯示小孩帳號不能註冊家長的文案', async () => {
    const { registerParent } = require('../../../lib/auth/registerParent');
    registerParent.mockRejectedValue(new Error('ALREADY_CHILD'));

    const { getByTestId } = render(<SignIn />);
    fireEvent.press(getByTestId('toggle-auth-mode'));
    fireEvent.changeText(getByTestId('email-input'), 'kid@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'kidpass123');
    fireEvent.changeText(getByTestId('displayname-input'), '小安');
    fireEvent.changeText(getByTestId('familyname-input'), '偷渡家庭');
    fireEvent.press(getByTestId('email-submit'));

    await waitFor(() =>
      expect(getByTestId('auth-error').props.children).toMatch(/小孩帳號/)
    );
  });

  // R3-2：一帳號一家庭守衛（i18n mock 讓 t 回傳 key 本身，斷言用 key 比對）
  it('註冊模式：CF 拋 ALREADY_IN_FAMILY → 顯示已加入其他家庭的文案', async () => {
    const { registerParent } = require('../../../lib/auth/registerParent');
    registerParent.mockRejectedValue(new Error('ALREADY_IN_FAMILY'));

    const { getByTestId } = render(<SignIn />);
    fireEvent.press(getByTestId('toggle-auth-mode'));
    fireEvent.changeText(getByTestId('email-input'), 'member@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'memberpass123');
    fireEvent.changeText(getByTestId('displayname-input'), '成員');
    fireEvent.changeText(getByTestId('familyname-input'), '第二家庭');
    fireEvent.press(getByTestId('email-submit'));

    await waitFor(() =>
      expect(getByTestId('auth-error').props.children).toMatch(/alreadyInFamily/)
    );
  });

  // R2-32：忘記密碼最小流程（i18n mock 讓 t 回傳 key 本身，斷言用 key 比對）
  it('忘記密碼：有填 email 點擊會呼叫 sendPasswordResetEmail 並提示已寄出', async () => {
    const reset = (auth as any).__mocks.sendPasswordResetEmail;
    reset.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<SignIn />);
    fireEvent.changeText(getByTestId('email-input'), '  mom@example.com  ');
    fireEvent.press(getByTestId('forgot-password'));

    await waitFor(() =>
      expect(reset).toHaveBeenCalledWith('mom@example.com')
    );
    expect(alertSpy).toHaveBeenCalledWith('auth.forgotPassword', 'auth.resetEmailSent');
  });

  it('忘記密碼：email 空不呼叫 sendPasswordResetEmail，提示先填 email', () => {
    const reset = (auth as any).__mocks.sendPasswordResetEmail;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<SignIn />);
    fireEvent.press(getByTestId('forgot-password'));

    expect(reset).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('auth.forgotPassword', 'auth.resetEmailEmptyEmail');
  });

  it('忘記密碼：user-not-found 沿用成功文案（避免帳號枚舉）', async () => {
    const reset = (auth as any).__mocks.sendPasswordResetEmail;
    reset.mockRejectedValue({ code: 'auth/user-not-found' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = render(<SignIn />);
    fireEvent.changeText(getByTestId('email-input'), 'ghost@example.com');
    fireEvent.press(getByTestId('forgot-password'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('auth.forgotPassword', 'auth.resetEmailSent')
    );
  });
});
