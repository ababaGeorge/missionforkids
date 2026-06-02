/* eslint-disable no-console */
//
// Cleanup anonymous dev test data (Plan D Section 5).
//
// Deletes by EXPLICIT markers only (codex #12) — never display-name heuristics:
//   - Firebase Auth users with NO provider (= anonymous)
//   - Firestore users where authProvider == 'anonymous'
//   - everything scoped to familyId == 'dev-family-001' (the dev family)
// Password accounts (seed dev-parent/kid + any real account) are NEVER touched.
//
// Auth: Application Default Credentials (gcloud auth application-default login).
// Run:
//   cd functions && node --experimental-strip-types scripts/cleanup-anon-dev-data.ts            # DRY RUN
//   cd functions && node --experimental-strip-types scripts/cleanup-anon-dev-data.ts --execute  # DELETE

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin') as typeof import('firebase-admin');

const EXECUTE = process.argv.includes('--execute');
const PROJECT_ID = 'mission-for-kids';
const DEV_FAMILY = 'dev-family-001';
const FAMILY_COLLECTIONS = [
  'familyMemberships',
  'pointWallets',
  'tasks',
  'taskInstances',
  'rewardItems',
  'rewardOrders',
  'inviteCodes',
];

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();

async function collectAnonAuthUsers() {
  const anon: { uid: string; displayName?: string }[] = [];
  let pageToken: string | undefined;
  let total = 0;
  do {
    const res = await auth.listUsers(1000, pageToken);
    total += res.users.length;
    for (const u of res.users) {
      // anonymous = no linked provider (password users have providerData 'password')
      if (!u.providerData || u.providerData.length === 0) {
        anon.push({ uid: u.uid, displayName: u.displayName });
      }
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return { anon, total };
}

async function main() {
  console.log(`\n▶ Cleanup anonymous dev data in ${PROJECT_ID}`);
  console.log(`  mode: ${EXECUTE ? '🔴 EXECUTE (will delete)' : '🟢 DRY RUN (read-only)'}\n`);

  // 1. anonymous Auth users
  const { anon, total } = await collectAnonAuthUsers();
  console.log(`Auth users: ${total} total, ${anon.length} anonymous → DELETE`);
  anon.slice(0, 30).forEach((u) => console.log(`  - ${u.uid} (${u.displayName ?? 'no name'})`));
  if (anon.length > 30) console.log(`  … +${anon.length - 30} more`);

  // 2. Firestore users with authProvider == 'anonymous'
  const anonUserDocs = (await db.collection('users').where('authProvider', '==', 'anonymous').get()).docs;
  console.log(`\nFirestore users (authProvider==anonymous): ${anonUserDocs.length} → DELETE`);

  // 3. dev-family-001 scoped docs
  console.log(`\nFamily-scoped docs (familyId==${DEV_FAMILY}):`);
  const famRefs: FirebaseFirestore.DocumentReference[] = [];
  for (const c of FAMILY_COLLECTIONS) {
    const docs = (await db.collection(c).where('familyId', '==', DEV_FAMILY).get()).docs;
    console.log(`  ${c}: ${docs.length}`);
    docs.forEach((d) => famRefs.push(d.ref));
  }
  const familySnap = await db.collection('families').doc(DEV_FAMILY).get();
  console.log(`  families/${DEV_FAMILY}: ${familySnap.exists ? 1 : 0}`);

  const allDocRefs = [
    ...anonUserDocs.map((d) => d.ref),
    ...famRefs,
    ...(familySnap.exists ? [familySnap.ref] : []),
  ];
  console.log(`\nTotal: ${anon.length} Auth users + ${allDocRefs.length} Firestore docs`);

  if (!EXECUTE) {
    console.log('\n🟢 DRY RUN — nothing deleted. Re-run with --execute to delete.\n');
    return;
  }

  // --- DELETE ---
  console.log('\n🔴 Deleting Firestore docs…');
  for (let i = 0; i < allDocRefs.length; i += 400) {
    const batch = db.batch();
    allDocRefs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
    console.log(`  committed ${Math.min(i + 400, allDocRefs.length)}/${allDocRefs.length}`);
  }

  console.log('🔴 Deleting anonymous Auth users…');
  const uids = anon.map((u) => u.uid);
  for (let i = 0; i < uids.length; i += 1000) {
    const res = await auth.deleteUsers(uids.slice(i, i + 1000));
    console.log(`  deleted ${res.successCount} ok, ${res.failureCount} failed`);
  }

  console.log('\n✅ Cleanup done.\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n✗ Cleanup failed:', e);
    process.exit(1);
  });
