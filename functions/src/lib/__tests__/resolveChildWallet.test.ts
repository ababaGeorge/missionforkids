import * as admin from 'firebase-admin';
import {
  resolveAuthoritativeChildId,
  resolveChildWallet,
} from '../resolveChildWallet';

const db = () => admin.firestore();

describe('resolveAuthoritativeChildId', () => {
  it('membership 有 childId → 回傳 childId', async () => {
    await db()
      .collection('familyMemberships')
      .doc('u1_fam')
      .set({ familyId: 'fam', userId: 'u1', childId: 'child-1', role: 'child', status: 'active' });
    await expect(resolveAuthoritativeChildId(db(), 'fam', 'u1')).resolves.toBe('child-1');
  });

  it('membership 無 childId 欄位（舊帳號）→ fallback 用 userId', async () => {
    await db()
      .collection('familyMemberships')
      .doc('u2_fam')
      .set({ familyId: 'fam', userId: 'u2', role: 'child', status: 'active' });
    await expect(resolveAuthoritativeChildId(db(), 'fam', 'u2')).resolves.toBe('u2');
  });

  it('membership 不存在 → 拋錯', async () => {
    await expect(resolveAuthoritativeChildId(db(), 'fam', 'ghost')).rejects.toThrow();
  });

  it('childId 是空字串 → 拋錯（不靜默 fallback）', async () => {
    await db()
      .collection('familyMemberships')
      .doc('u3_fam')
      .set({ familyId: 'fam', userId: 'u3', childId: '', role: 'child', status: 'active' });
    await expect(resolveAuthoritativeChildId(db(), 'fam', 'u3')).rejects.toThrow();
  });

  it('membership.familyId 與傳入不符（跨家庭）→ 拋錯', async () => {
    await db()
      .collection('familyMemberships')
      .doc('u4_fam')
      .set({ familyId: 'other-fam', userId: 'u4', childId: 'c4', role: 'child', status: 'active' });
    await expect(resolveAuthoritativeChildId(db(), 'fam', 'u4')).rejects.toThrow();
  });
});

describe('resolveChildWallet', () => {
  it('錢包不存在 → exists:false、balance:0、ref id = {familyId}_{childId}', async () => {
    const result = await db().runTransaction((tx) =>
      resolveChildWallet(tx, db(), 'fam', 'child-x')
    );
    expect(result.exists).toBe(false);
    expect(result.balance).toBe(0);
    expect(result.ref.id).toBe('fam_child-x');
  });

  it('錢包已存在 → exists:true、回現有 balance', async () => {
    await db()
      .collection('pointWallets')
      .doc('fam_child-y')
      .set({ childId: 'child-y', userId: 'child-y', familyId: 'fam', balance: 42 });
    const result = await db().runTransaction((tx) =>
      resolveChildWallet(tx, db(), 'fam', 'child-y')
    );
    expect(result.exists).toBe(true);
    expect(result.balance).toBe(42);
  });
});
