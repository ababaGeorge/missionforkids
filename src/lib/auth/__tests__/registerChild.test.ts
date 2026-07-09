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

  it('孤兒帳號恢復：email 已被使用 → 改登入取回 session，仍補跑 acceptFamilyInvite', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    const signIn = (auth as any).__mocks.signInWithEmailAndPassword;
    createUser.mockRejectedValue(
      Object.assign(new Error('email in use'), { code: 'auth/email-already-in-use' })
    );
    signIn.mockResolvedValue({ user: { uid: 'child-uid' } });

    const callable = jest.fn(async () => ({ data: { familyId: 'fam-1', childId: 'child-uid' } }));
    (functions as any).__mocks.httpsCallable.mockReturnValue(callable);

    const res = await registerChild({
      inviteId: 'inv-1',
      email: 'kid@example.com',
      password: 'secret123',
    });

    expect(signIn).toHaveBeenCalledWith('kid@example.com', 'secret123');
    expect(callable).toHaveBeenCalledWith({ inviteId: 'inv-1' });
    expect(res).toEqual({ familyId: 'fam-1', childId: 'child-uid' });
  });

  it('恢復登入密碼不符 → 拋 EMAIL_TAKEN_PASSWORD_MISMATCH，不呼叫 CF', async () => {
    const createUser = (auth as any).__mocks.createUserWithEmailAndPassword;
    const signIn = (auth as any).__mocks.signInWithEmailAndPassword;
    createUser.mockRejectedValue(
      Object.assign(new Error('email in use'), { code: 'auth/email-already-in-use' })
    );
    signIn.mockRejectedValue(
      Object.assign(new Error('wrong password'), { code: 'auth/invalid-credential' })
    );

    await expect(
      registerChild({ inviteId: 'inv-1', email: 'kid@example.com', password: 'wrong-pass' })
    ).rejects.toMatchObject({
      code: 'auth/email-taken-password-mismatch',
      message: 'EMAIL_TAKEN_PASSWORD_MISMATCH',
    });
    expect((functions as any).__mocks.httpsCallable).not.toHaveBeenCalled();
  });
});
