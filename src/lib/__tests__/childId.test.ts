import { walletDocId, childIdFor, resolveMyChildId } from '../childId';

const mockGet = jest.fn();
jest.mock('@react-native-firebase/firestore', () => {
  const fn: any = () => ({
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  });
  return { __esModule: true, default: fn };
});

describe('walletDocId', () => {
  it('組 {familyId}_{childId}', () => {
    expect(walletDocId('fam', 'child-1')).toBe('fam_child-1');
  });
});

describe('childIdFor', () => {
  it('user 有 childId → 回 childId', () => {
    expect(childIdFor({ childId: 'perm-1' } as any, 'uid-1')).toBe('perm-1');
  });
  it('user 無 childId（舊帳號）→ fallback uid', () => {
    expect(childIdFor({} as any, 'uid-2')).toBe('uid-2');
    expect(childIdFor(null, 'uid-3')).toBe('uid-3');
  });
});

describe('resolveMyChildId', () => {
  beforeEach(() => jest.clearAllMocks());
  it('users/{uid}.childId 存在 → 回它', async () => {
    mockGet.mockResolvedValue({ data: () => ({ childId: 'perm-x' }) });
    await expect(resolveMyChildId('uid-x')).resolves.toBe('perm-x');
  });
  it('無 childId → 回 uid', async () => {
    mockGet.mockResolvedValue({ data: () => ({}) });
    await expect(resolveMyChildId('uid-y')).resolves.toBe('uid-y');
  });
});
