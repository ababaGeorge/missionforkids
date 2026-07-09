import { resolveMemberUser } from '../memberName';

const mockDocGet = jest.fn();
const mockQueryGet = jest.fn();
jest.mock('@react-native-firebase/firestore', () => {
  const chain: any = {};
  chain.where = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.get = (...args: unknown[]) => mockQueryGet(...args);
  const fn: any = () => ({
    collection: () => ({
      doc: () => ({ get: mockDocGet }),
      where: chain.where,
    }),
  });
  return { __esModule: true, default: fn };
});

describe('resolveMemberUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('doc id 直查命中 → 回該 user', async () => {
    mockDocGet.mockResolvedValue({
      exists: () => true,
      id: 'uid-1',
      data: () => ({ displayName: '爸爸' }),
    });
    await expect(resolveMemberUser('uid-1')).resolves.toEqual({
      id: 'uid-1',
      displayName: '爸爸',
    });
    expect(mockQueryGet).not.toHaveBeenCalled();
  });

  it('直查不存在 → authProviderId fallback 命中（舊資料小孩）', async () => {
    mockDocGet.mockResolvedValue({ exists: () => false });
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ id: 'placeholder-1', data: () => ({ displayName: 'QQ' }) }],
    });
    await expect(resolveMemberUser('auth-uid-1')).resolves.toEqual({
      id: 'placeholder-1',
      displayName: 'QQ',
    });
  });

  it('fallback 查詢 permission-denied（加固 rules）→ 回 null 不炸', async () => {
    mockDocGet.mockResolvedValue({ exists: () => false });
    mockQueryGet.mockRejectedValue(
      Object.assign(new Error('permission-denied'), {
        code: 'firestore/permission-denied',
      })
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(resolveMemberUser('auth-uid-2')).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('直查與 fallback 都查無 → 回 null', async () => {
    mockDocGet.mockResolvedValue({ exists: () => false });
    mockQueryGet.mockResolvedValue({ empty: true, docs: [] });
    await expect(resolveMemberUser('nobody')).resolves.toBeNull();
  });
});
