import * as admin from 'firebase-admin';
describe('emulator smoke', () => {
  it('writes to firestore emulator and reads back', async () => {
    const db = admin.firestore();
    await db.collection('smoke').doc('x').set({ ok: true });
    const snap = await db.collection('smoke').doc('x').get();
    expect(snap.data()).toEqual({ ok: true });
  });
});
