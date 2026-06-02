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
});
