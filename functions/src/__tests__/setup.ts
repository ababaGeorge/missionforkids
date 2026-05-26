import * as admin from 'firebase-admin';
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'mission-for-kids' });
}
afterEach(async () => {
  const db = admin.firestore();
  const collections = await db.listCollections();
  await Promise.all(
    collections.map(async (c) => {
      const docs = await c.listDocuments();
      await Promise.all(docs.map((d) => d.delete()));
    })
  );
});
