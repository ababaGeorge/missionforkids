import {
  updateOrderIfStatusIn,
  updateOrderIfPending,
  ORDER_STALE_MESSAGES,
} from '../orders';

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

const orderSnap = (status: string) => ({
  exists: () => true,
  data: () => ({ status }),
});

describe('updateOrderIfStatusIn（交易內重讀訂單的狀態守衛）', () => {
  beforeEach(() => jest.clearAllMocks());

  it('狀態在允許的前置集合內 → 交易內寫入欄位', async () => {
    mockTxGet.mockResolvedValue(orderSnap('approved'));
    await updateOrderIfStatusIn('o1', ['approved'], { status: 'delivered' });
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1' }),
      { status: 'delivered' }
    );
  });

  it('訂單不存在 → 拋 ORDER_GONE、不寫入', async () => {
    mockTxGet.mockResolvedValue({ exists: () => false });
    await expect(
      updateOrderIfStatusIn('o1', ['approved'], { status: 'delivered' })
    ).rejects.toThrow('ORDER_GONE');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('已被小孩取消（cancelled，點數已退）→ 拋 ORDER_CANCELLED、不寫入', async () => {
    mockTxGet.mockResolvedValue(orderSnap('cancelled'));
    await expect(
      updateOrderIfStatusIn('o1', ['approved'], { status: 'delivered' })
    ).rejects.toThrow('ORDER_CANCELLED');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('非前置狀態（如已 delivered）→ 拋 ORDER_ALREADY_HANDLED、不寫入', async () => {
    mockTxGet.mockResolvedValue(orderSnap('delivered'));
    await expect(
      updateOrderIfStatusIn('o1', ['approved'], { status: 'delivered' })
    ).rejects.toThrow('ORDER_ALREADY_HANDLED');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('status 欄位缺漏（壞資料）→ 視為非前置狀態，拋 ORDER_ALREADY_HANDLED', async () => {
    mockTxGet.mockResolvedValue({ exists: () => true, data: () => ({}) });
    await expect(
      updateOrderIfStatusIn('o1', ['approved'], { status: 'delivered' })
    ).rejects.toThrow('ORDER_ALREADY_HANDLED');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});

describe('updateOrderIfPending（R2-04 家長核准/婉拒守衛，前置狀態 {pending}）', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pending → 允許寫入', async () => {
    mockTxGet.mockResolvedValue(orderSnap('pending'));
    await updateOrderIfPending('o1', { status: 'approved' });
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1' }),
      { status: 'approved' }
    );
  });

  it('cancelled → 拋 ORDER_CANCELLED', async () => {
    mockTxGet.mockResolvedValue(orderSnap('cancelled'));
    await expect(
      updateOrderIfPending('o1', { status: 'approved' })
    ).rejects.toThrow('ORDER_CANCELLED');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('已處理過（approved）→ 拋 ORDER_ALREADY_HANDLED', async () => {
    mockTxGet.mockResolvedValue(orderSnap('approved'));
    await expect(
      updateOrderIfPending('o1', { status: 'rejected' })
    ).rejects.toThrow('ORDER_ALREADY_HANDLED');
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});

describe('ORDER_STALE_MESSAGES（三態錯誤碼的友善訊息）', () => {
  it('三個錯誤碼都有對應訊息', () => {
    expect(Object.keys(ORDER_STALE_MESSAGES).sort()).toEqual([
      'ORDER_ALREADY_HANDLED',
      'ORDER_CANCELLED',
      'ORDER_GONE',
    ]);
    for (const msg of Object.values(ORDER_STALE_MESSAGES)) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});
