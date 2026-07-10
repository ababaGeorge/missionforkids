import {
  updateInstanceIfStatusIn,
  submitInstanceGuarded,
  INSTANCE_STALE_MESSAGES,
} from '../instances';

const mockTxGet = jest.fn();
const mockTxUpdate = jest.fn();
const mockTxSet = jest.fn();
jest.mock('@react-native-firebase/firestore', () => {
  const fn: any = () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({ id, path: `${name}/${id}` }),
    }),
    runTransaction: async (cb: any) =>
      cb({ get: mockTxGet, update: mockTxUpdate, set: mockTxSet }),
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

describe('submitInstanceGuarded（R3-4b 小孩提交的交易守衛）', () => {
  beforeEach(() => jest.clearAllMocks());

  /** 依交易內讀取的 ref 分流：taskInstances/* 回 instance 快照、tasks/* 回 task 快照 */
  const arrangeReads = (
    inst: { exists?: boolean; data?: Record<string, any> },
    task: { exists?: boolean; data?: Record<string, any> }
  ) => {
    mockTxGet.mockImplementation(async (ref: any) => {
      const src = ref.path?.startsWith('tasks/') ? task : inst;
      return {
        exists: () => src.exists !== false,
        data: () => src.data ?? {},
      };
    });
  };

  const baseParams = {
    instanceId: 'i1',
    taskId: 't1',
    maxSubmissions: 3,
    instanceFields: { status: 'submitted' },
    submission: {
      ref: { id: 's1', path: 'taskSubmissions/s1' } as any,
      fields: { taskInstanceId: 'i1' },
    },
  };

  it('正例：pending＋未達上限＋task 未封存 → 同交易建 submission＋更新 instance', async () => {
    arrangeReads(
      { data: { status: 'pending', submissionCount: 0 } },
      { data: { status: 'active' } }
    );
    await submitInstanceGuarded(baseParams);
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }),
      { taskInstanceId: 'i1' }
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      { status: 'submitted' }
    );
  });

  it('正例：rejected（被退回重交）也是允許的來源狀態', async () => {
    arrangeReads(
      { data: { status: 'rejected', submissionCount: 2 } },
      { data: { status: 'active' } }
    );
    await submitInstanceGuarded(baseParams);
    expect(mockTxUpdate).toHaveBeenCalled();
  });

  it('task 已封存（家長 soft delete）→ 拋 TASK_ARCHIVED、不寫入', async () => {
    arrangeReads(
      { data: { status: 'pending', submissionCount: 0 } },
      { data: { status: 'archived' } }
    );
    await expect(submitInstanceGuarded(baseParams)).rejects.toThrow(
      'TASK_ARCHIVED'
    );
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('task doc 不存在（已被移除）→ 視同封存，拋 TASK_ARCHIVED、不寫入', async () => {
    arrangeReads(
      { data: { status: 'pending', submissionCount: 0 } },
      { exists: false }
    );
    await expect(submitInstanceGuarded(baseParams)).rejects.toThrow(
      'TASK_ARCHIVED'
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('instance 不存在 → 拋 INSTANCE_GONE、不寫入', async () => {
    arrangeReads({ exists: false }, { data: { status: 'active' } });
    await expect(submitInstanceGuarded(baseParams)).rejects.toThrow(
      'INSTANCE_GONE'
    );
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('重讀 submissionCount 已達上限（本地 state 過時）→ 拋 MAX_SUBMISSIONS、不寫入', async () => {
    arrangeReads(
      { data: { status: 'pending', submissionCount: 3 } },
      { data: { status: 'active' } }
    );
    await expect(submitInstanceGuarded(baseParams)).rejects.toThrow(
      'MAX_SUBMISSIONS'
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('狀態不在提交來源集合（如已被標 missed）→ 拋 INSTANCE_NOT_SUBMITTABLE、不寫入', async () => {
    arrangeReads(
      { data: { status: 'missed', submissionCount: 0 } },
      { data: { status: 'active' } }
    );
    await expect(submitInstanceGuarded(baseParams)).rejects.toThrow(
      'INSTANCE_NOT_SUBMITTABLE'
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('狀態已是 submitted（連點兩下）→ 拋 INSTANCE_NOT_SUBMITTABLE，不重複計數', async () => {
    arrangeReads(
      { data: { status: 'submitted', submissionCount: 1 } },
      { data: { status: 'active' } }
    );
    await expect(submitInstanceGuarded(baseParams)).rejects.toThrow(
      'INSTANCE_NOT_SUBMITTABLE'
    );
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('不帶 submission（呼叫端只更新 instance）→ 只 update、不 set', async () => {
    arrangeReads(
      { data: { status: 'pending', submissionCount: 0 } },
      { data: { status: 'active' } }
    );
    const { submission: _omit, ...withoutSubmission } = baseParams;
    await submitInstanceGuarded(withoutSubmission);
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      { status: 'submitted' }
    );
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
