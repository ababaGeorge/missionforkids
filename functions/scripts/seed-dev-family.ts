/* eslint-disable no-console */
//
// Dev test-account seed (Plan D).
//
// Creates fixed REAL accounts (stable UIDs) so childId / wallet / instance doc ids
// never drift across re-runs. Replaces the anonymous dev sign-in shortcut.
//
// Auth: Application Default Credentials. Run once first:
//   ! gcloud auth application-default login
//   ! gcloud auth application-default set-quota-project mission-for-kids
//
// Then:
//   cd functions && node --experimental-strip-types scripts/seed-dev-family.ts
//
// Idempotent: re-running resets the same accounts/docs in place.

import { createRequire } from 'node:module';
import {
  buildParentUserDoc,
  buildFamilyDoc,
  buildParentMembership,
  buildChildUserDoc,
  buildChildMembership,
  buildChildWallet,
  buildTaskInstance,
} from '../src/devSeed/shapes.ts';

// firebase-admin is CommonJS; under Node's ESM type-stripping a namespace import
// (`import * as admin`) doesn't expose its members. Load it with CJS semantics.
const require = createRequire(import.meta.url);
const admin = require('firebase-admin') as typeof import('firebase-admin');

const PROJECT_ID = 'mission-for-kids';
const FAMILY_ID = 'dev-family-seed';
const FAMILY_NAME = 'Dev 測試家庭';
// Non-secret test credential for the throwaway @mfk.test domain. Overridable via env.
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD ?? 'mfk-dev-2026!';

const PARENT = { uid: 'dev-parent', email: 'dev-parent@mfk.test', displayName: '測試家長' };
const KIDS = [
  { uid: 'dev-kid1', email: 'dev-kid1@mfk.test', displayName: '小安', nickname: '小安', avatarEmoji: '🦊' },
  { uid: 'dev-kid2', email: 'dev-kid2@mfk.test', displayName: '小宇', nickname: '小宇', avatarEmoji: '🐼' },
];

// Sample task set (mirrors the old seedDevTasks content, now per-kid + childId-tagged).
type TaskSeed = {
  base: string;
  title: string;
  points: number;
  frequency: 'daily' | 'weekly';
  instanceStatus: 'pending' | 'submitted' | 'approved';
  parentHint?: string;
};
const TASK_SEEDS: TaskSeed[] = [
  { base: 'dev-task-brush', title: '刷牙', points: 5, frequency: 'daily', instanceStatus: 'approved', parentHint: '記得上下都要刷，至少兩分鐘喔' },
  { base: 'dev-task-desk', title: '整理書桌', points: 10, frequency: 'daily', instanceStatus: 'pending', parentHint: '書本和鉛筆都要收好喔' },
  { base: 'dev-task-fish', title: '餵魚', points: 3, frequency: 'daily', instanceStatus: 'approved' },
  { base: 'dev-task-homework', title: '寫作業', points: 15, frequency: 'daily', instanceStatus: 'submitted', parentHint: '不會的可以先跳過，最後再問' },
  { base: 'dev-task-trash', title: '倒垃圾', points: 20, frequency: 'weekly', instanceStatus: 'pending', parentHint: '記得把袋口綁好再丟' },
  { base: 'dev-task-toys', title: '整理玩具', points: 15, frequency: 'weekly', instanceStatus: 'pending' },
];

// Family-level rewards (child rewards page queries by familyId, not childId).
const REWARD_SEEDS = [
  { id: 'dev-reward-ice', title: '吃冰淇淋', pointCost: 50, emoji: '🍦' },
  { id: 'dev-reward-game', title: '遊戲 30 分鐘', pointCost: 30, emoji: '🎮' },
  { id: 'dev-reward-movie', title: '選電影', pointCost: 100, emoji: '🎬' },
  { id: 'dev-reward-book', title: '新的書', pointCost: 200, emoji: '📖' },
  { id: 'dev-reward-latenight', title: '晚睡 30 分鐘', pointCost: 80, emoji: '🌙' },
  { id: 'dev-reward-lego', title: '樂高', pointCost: 500, emoji: '🧱' },
];

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

async function upsertAuthUser(u: { uid: string; email: string; displayName: string }) {
  const props = { email: u.email, password: DEV_PASSWORD, displayName: u.displayName, emailVerified: true };
  try {
    await auth.getUser(u.uid);
    await auth.updateUser(u.uid, props);
    console.log(`  ✓ auth user updated: ${u.uid} (${u.email})`);
  } catch (e: any) {
    if (e?.code === 'auth/user-not-found') {
      await auth.createUser({ uid: u.uid, ...props });
      console.log(`  ✓ auth user created: ${u.uid} (${u.email})`);
    } else {
      throw e;
    }
  }
}

async function seed() {
  console.log(`\n▶ Seeding dev family into ${PROJECT_ID} (familyId=${FAMILY_ID})\n`);

  // 1. Auth users (stable UIDs)
  console.log('1/5 Auth users…');
  await upsertAuthUser(PARENT);
  for (const k of KIDS) await upsertAuthUser(k);

  const now = FieldValue.serverTimestamp();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);
  const dayStart = Timestamp.fromDate(startOfDay);
  const dayEnd = Timestamp.fromDate(endOfDay);

  // 2. Parent + family + parent membership (mirror bootstrapParentAccount)
  console.log('2/5 Parent + family…');
  const batch = db.batch();
  batch.set(db.collection('users').doc(PARENT.uid),
    buildParentUserDoc({ uid: PARENT.uid, displayName: PARENT.displayName, email: PARENT.email, now }));
  batch.set(db.collection('families').doc(FAMILY_ID),
    buildFamilyDoc({ displayName: FAMILY_NAME, createdBy: PARENT.uid, now }));
  batch.set(db.collection('familyMemberships').doc(`${PARENT.uid}_${FAMILY_ID}`),
    buildParentMembership({ familyId: FAMILY_ID, uid: PARENT.uid, now }));

  // 3. Family-level rewards
  console.log('3/5 Rewards…');
  for (const r of REWARD_SEEDS) {
    batch.set(db.collection('rewardItems').doc(r.id), {
      familyId: FAMILY_ID,
      title: r.title,
      description: null,
      pointCost: r.pointCost,
      itemType: 'physical',
      emoji: r.emoji,
      imageUrl: null,
      status: 'active',
      createdBy: PARENT.uid,
      createdAt: now,
    });
  }
  await batch.commit();

  // 4. Each kid: user + membership + wallet + tasks + instances + one delivered order
  console.log('4/5 Kids (users, wallets, tasks, instances)…');
  for (const k of KIDS) {
    const kb = db.batch();
    // balance is authoritative from the wallet doc; seed it to match pre-approved tasks.
    const approvedPoints = TASK_SEEDS
      .filter((t) => t.instanceStatus === 'approved')
      .reduce((sum, t) => sum + t.points, 0);

    kb.set(db.collection('users').doc(k.uid),
      buildChildUserDoc({ uid: k.uid, displayName: k.displayName, email: k.email, now }));
    kb.set(db.collection('familyMemberships').doc(`${k.uid}_${FAMILY_ID}`),
      buildChildMembership({ familyId: FAMILY_ID, uid: k.uid, invitedBy: PARENT.uid, nickname: k.nickname, avatarEmoji: k.avatarEmoji, now }));
    kb.set(db.collection('pointWallets').doc(`${FAMILY_ID}_${k.uid}`),
      buildChildWallet({ familyId: FAMILY_ID, uid: k.uid, balance: approvedPoints, now }));

    for (const t of TASK_SEEDS) {
      const taskId = `${t.base}-${k.uid}`;
      kb.set(db.collection('tasks').doc(taskId), {
        familyId: FAMILY_ID,
        title: t.title,
        points: t.points,
        frequency: t.frequency,
        startDate: dayStart,
        dueDate: dayEnd,
        graceDays: 0,
        reviewMode: 'semi_auto',
        assigneeType: 'individual',
        assigneeUserId: k.uid,
        status: 'active',
        createdBy: PARENT.uid,
        createdAt: now,
        parentHint: t.parentHint ?? null,
      });
      kb.set(db.collection('taskInstances').doc(`${taskId}_today`),
        buildTaskInstance({
          taskId,
          uid: k.uid,
          familyId: FAMILY_ID,
          periodStart: dayStart,
          periodEnd: dayEnd,
          gracePeriodEnd: dayEnd,
          status: t.instanceStatus,
          submissionCount: t.instanceStatus === 'pending' ? 0 : 1,
          reviewedBy: t.instanceStatus === 'approved' ? PARENT.uid : null,
          reviewedAt: t.instanceStatus === 'approved' ? Timestamp.now() : null,
          pointsAwarded: t.instanceStatus === 'approved' ? t.points : null,
        }));
    }

    // one delivered reward order (history); childId so child rewards "history" tab shows it
    kb.set(db.collection('rewardOrders').doc(`dev-order-ice-${k.uid}`), {
      familyId: FAMILY_ID,
      userId: k.uid,
      childId: k.uid,
      itemId: 'dev-reward-ice',
      pointCostSnapshot: 50,
      status: 'delivered',
      cancelledAt: null,
      approvedAt: Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000)),
      deliveredAt: Timestamp.now(),
      createdAt: now,
    });

    await kb.commit();
    console.log(`  ✓ ${k.uid} seeded (wallet balance=${approvedPoints})`);
  }

  console.log('\n5/5 Done.');
  console.log('\n── Login credentials ──');
  console.log(`  parent: ${PARENT.email}`);
  for (const k of KIDS) console.log(`  child:  ${k.email}`);
  console.log(`  password (all): ${DEV_PASSWORD}`);
  console.log(`  familyId: ${FAMILY_ID}\n`);
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n✗ Seed failed:', e);
    process.exit(1);
  });
