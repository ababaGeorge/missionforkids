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
});
