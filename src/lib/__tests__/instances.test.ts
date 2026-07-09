import {
  updateInstanceIfStatusIn,
  INSTANCE_STALE_MESSAGES,
} from '../instances';

const mockTxGet = jest.fn();
const mockTxUpdate = jest.fn();
jest.mock('@react-native-firebase/firestore', () => {
  const fn: any = () => ({
    collection: () => ({
      doc: (id: string) => ({ id }),
    }),
    runTransaction: async (cb: any) =>
      cb({ get: mockTxGet, update: mockTxUpdate }),
  });
  return { __esModule: true, default: fn };
});

const instanceSnap = (data: Record<string, any>) => ({
  exists: () => true,
  data: () => data,
});

describe('updateInstanceIfStatusIn（交易內重讀任務 instance 的狀態守衛）', () => {
  beforeEach(() => jest.clearAllMocks());

  it('狀態在允許的前置集合內 → 交易內寫入欄位', async () => {
    mockTxGet.mockResolvedValue(instanceSnap({ status: 'submitted' }));
    await updateInstanceIfStatusIn('i1', ['submitted'], { status: 'approved' });
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      { status: 'approved' }
    );
  });

  it('instance 不存在（如任務編輯後被移除）→ 拋 INSTANCE_GONE、不寫入', async () => {
    mockTxGet.mockResolvedValue({ exists: () => false });
    await expect(
      updateInstanceIfStatusIn('i1', ['submitted'], { status: 'approved' })
    ).rejects.toThrow('INSTANCE_GONE');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('非前置狀態（如已被標 missed）→ 拋 INSTANCE_NOT_SUBMITTED、不寫入', async () => {
    mockTxGet.mockResolvedValue(instanceSnap({ status: 'missed' }));
    await expect(
      updateInstanceIfStatusIn('i1', ['submitted'], { status: 'approved' })
    ).rejects.toThrow('INSTANCE_NOT_SUBMITTED');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('status 欄位缺漏（壞資料）→ 視為非前置狀態，拋 INSTANCE_NOT_SUBMITTED', async () => {
    mockTxGet.mockResolvedValue(instanceSnap({}));
    await expect(
      updateInstanceIfStatusIn('i1', ['submitted'], { status: 'approved' })
    ).rejects.toThrow('INSTANCE_NOT_SUBMITTED');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('fieldsOrFn 為回呼 → 拿到交易內重讀的資料，回傳值被寫入', async () => {
    mockTxGet.mockResolvedValue(
      instanceSnap({ status: 'submitted', submissionCount: 3 })
    );
    const fn = jest.fn((data: Record<string, any>) => ({
      status: (data.submissionCount || 0) >= 3 ? 'missed' : 'rejected',
    }));
    await updateInstanceIfStatusIn('i1', ['submitted'], fn);
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted', submissionCount: 3 })
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      { status: 'missed' }
    );
  });

  it('回呼＋重讀 submissionCount 未達三振門檻 → 寫 rejected（不是 missed）', async () => {
    mockTxGet.mockResolvedValue(
      instanceSnap({ status: 'submitted', submissionCount: 1 })
    );
    await updateInstanceIfStatusIn('i1', ['submitted'], (data) => ({
      status: (data.submissionCount || 0) >= 3 ? 'missed' : 'rejected',
    }));
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      { status: 'rejected' }
    );
  });

  it('回呼版遇到非前置狀態 → 回呼不被呼叫、拋碼、不寫入', async () => {
    mockTxGet.mockResolvedValue(instanceSnap({ status: 'approved' }));
    const fn = jest.fn(() => ({ status: 'rejected' }));
    await expect(
      updateInstanceIfStatusIn('i1', ['submitted'], fn)
    ).rejects.toThrow('INSTANCE_NOT_SUBMITTED');
    expect(fn).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});

describe('INSTANCE_STALE_MESSAGES（錯誤碼的友善訊息）', () => {
  it('兩個錯誤碼都有對應訊息', () => {
    expect(Object.keys(INSTANCE_STALE_MESSAGES).sort()).toEqual([
      'INSTANCE_GONE',
      'INSTANCE_NOT_SUBMITTED',
    ]);
    for (const msg of Object.values(INSTANCE_STALE_MESSAGES)) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});
