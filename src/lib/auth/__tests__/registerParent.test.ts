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

  it('孤兒帳號恢復：email 已被使用 → 改登入取回 session，仍補跑 bootstrapParentAccount', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    const signIn = (auth as any).__mocks.signInWithEmailAndPassword;
    createUser.mockRejectedValue(
      Object.assign(new Error('email in use'), { code: 'auth/email-already-in-use' })
    );
    signIn.mockResolvedValue({ user: { uid: 'orphan-uid' } });

    const callable = jest.fn(async () => ({ data: { familyId: 'fam-123' } }));
    (functions as any).__mocks.httpsCallable.mockReturnValue(callable);

    const res = await registerParent({
      email: 'mom@example.com',
      password: 'secret123',
      displayName: '媽媽',
      familyName: '我們家',
    });

    expect(signIn).toHaveBeenCalledWith('mom@example.com', 'secret123');
    expect(callable).toHaveBeenCalledWith({ displayName: '媽媽', familyName: '我們家' });
    expect(res).toEqual({ familyId: 'fam-123' });
  });

  it('恢復登入密碼不符 → 拋 EMAIL_TAKEN_PASSWORD_MISMATCH，不呼叫 CF', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    const signIn = (auth as any).__mocks.signInWithEmailAndPassword;
    createUser.mockRejectedValue(
      Object.assign(new Error('email in use'), { code: 'auth/email-already-in-use' })
    );
    signIn.mockRejectedValue(
      Object.assign(new Error('wrong password'), { code: 'auth/wrong-password' })
    );

    await expect(
      registerParent({
        email: 'mom@example.com',
        password: 'wrong-pass',
        displayName: '媽媽',
        familyName: '我們家',
      })
    ).rejects.toMatchObject({
      code: 'auth/email-taken-password-mismatch',
      message: 'EMAIL_TAKEN_PASSWORD_MISMATCH',
    });
    expect((functions as any).__mocks.httpsCallable).not.toHaveBeenCalled();
  });

  // R2-21(R2-05 審查)：角色衝突是永久性錯誤，裝置不得默默停留在已登入的小孩帳號
  it('CF 拋 ALREADY_CHILD → 先登出再拋錯，不殘留錯誤角色 session', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    const signIn = (auth as any).__mocks.signInWithEmailAndPassword;
    const signOut = (auth as any).__mocks.signOut;
    createUser.mockRejectedValue(
      Object.assign(new Error('email in use'), { code: 'auth/email-already-in-use' })
    );
    signIn.mockResolvedValue({ user: { uid: 'kid-uid' } });
    const callable = jest.fn(async () => {
      throw new Error('ALREADY_CHILD');
    });
    (functions as any).__mocks.httpsCallable.mockReturnValue(callable);

    await expect(
      registerParent({
        email: 'kid@example.com',
        password: 'secret123',
        displayName: '媽媽',
        familyName: '我們家',
      })
    ).rejects.toThrow('ALREADY_CHILD');
    expect(signOut).toHaveBeenCalled();
  });

  it('CF 拋非角色衝突錯誤（網路/冷啟動）→ 不登出，保留 session 供重試恢復', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    const signOut = (auth as any).__mocks.signOut;
    createUser.mockResolvedValue({ user: { uid: 'new-uid' } });
    const callable = jest.fn(async () => {
      throw new Error('deadline-exceeded');
    });
    (functions as any).__mocks.httpsCallable.mockReturnValue(callable);

    await expect(
      registerParent({
        email: 'mom@example.com',
        password: 'secret123',
        displayName: '媽媽',
        familyName: '我們家',
      })
    ).rejects.toThrow('deadline-exceeded');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('createUser 其他錯誤直接拋出，不嘗試恢復登入', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    const signIn = (auth as any).__mocks.signInWithEmailAndPassword;
    createUser.mockRejectedValue(
      Object.assign(new Error('bad email'), { code: 'auth/invalid-email' })
    );

    await expect(
      registerParent({
        email: 'not-an-email',
        password: 'secret123',
        displayName: '媽媽',
        familyName: '我們家',
      })
    ).rejects.toMatchObject({ code: 'auth/invalid-email' });
    expect(signIn).not.toHaveBeenCalled();
  });
});
