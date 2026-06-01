// Dev-only test-account seed shapes.
//
// NOT wired into index.ts — never deployed/executed as a function. These are pure
// builders so the seed script (functions/scripts/seed-dev-family.ts) and the shape
// assertion test (src/__tests__/seed-shapes.test.ts) share one source of truth.
//
// Field shapes MIRROR the authoritative onCall functions so the seed never drifts:
//   - parent docs ← bootstrapParentAccount.ts
//   - child docs  ← acceptFamilyInvite.ts
//   - taskInstance.childId ← child pages read `where('childId','==',childId)` (Plan C)
//
// Timestamps are injected by the caller (serverTimestamp / Timestamp sentinel) so the
// builders stay pure and testable.

export type Ts = unknown;

// ── Parent (mirror bootstrapParentAccount.ts) ────────────────────────────────
export function buildParentUserDoc(p: {
  uid: string;
  displayName: string;
  email: string;
  now: Ts;
}) {
  return {
    displayName: p.displayName,
    avatarUrl: null,
    authProvider: 'password',
    authProviderId: p.uid,
    roleType: 'parent',
    email: p.email,
    birthday: null,
    createdAt: p.now,
  };
}

export function buildFamilyDoc(p: { displayName: string; createdBy: string; now: Ts }) {
  return {
    displayName: p.displayName,
    defaultGraceDays: 2,
    createdBy: p.createdBy,
    createdAt: p.now,
  };
}

export function buildParentMembership(p: { familyId: string; uid: string; now: Ts }) {
  return {
    familyId: p.familyId,
    userId: p.uid,
    role: 'parent',
    status: 'active',
    invitedBy: p.uid,
    joinedAt: p.now,
  };
}

// ── Child (mirror acceptFamilyInvite.ts) ─────────────────────────────────────
export function buildChildUserDoc(p: {
  uid: string;
  displayName: string;
  email: string;
  now: Ts;
}) {
  return {
    displayName: p.displayName,
    avatarUrl: null,
    authProvider: 'password',
    authProviderId: p.uid,
    roleType: 'child',
    childId: p.uid, // childId == uid (stable seed UID)
    email: p.email,
    birthday: null,
    createdAt: p.now,
  };
}

export function buildChildMembership(p: {
  familyId: string;
  uid: string;
  invitedBy: string;
  nickname: string | null;
  avatarEmoji: string | null;
  now: Ts;
}) {
  return {
    familyId: p.familyId,
    userId: p.uid,
    childId: p.uid,
    role: 'child',
    status: 'active',
    invitedBy: p.invitedBy,
    joinedAt: p.now,
    nickname: p.nickname,
    avatarEmoji: p.avatarEmoji,
  };
}

export function buildChildWallet(p: {
  familyId: string;
  uid: string;
  balance: number;
  now: Ts;
}) {
  return {
    childId: p.uid,
    userId: p.uid,
    familyId: p.familyId,
    balance: p.balance,
    updatedAt: p.now,
  };
}

// ── taskInstance (mirror client write + Plan C childId read) ──────────────────
// onTaskInstanceApproved re-resolves childId from membership via userId, so userId is
// authoritative for the wallet; childId is what the child task page filters on.
export function buildTaskInstance(p: {
  taskId: string;
  uid: string;
  familyId: string;
  periodStart: Ts;
  periodEnd: Ts;
  gracePeriodEnd: Ts;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  submissionCount: number;
  reviewedBy: string | null;
  reviewedAt: Ts | null;
  pointsAwarded: number | null;
}) {
  return {
    taskId: p.taskId,
    userId: p.uid,
    childId: p.uid, // codex #6: child pages query `where('childId','==',childId)`
    familyId: p.familyId,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    gracePeriodEnd: p.gracePeriodEnd,
    status: p.status,
    submissionCount: p.submissionCount,
    reviewedBy: p.reviewedBy,
    reviewedAt: p.reviewedAt,
    pointsAwarded: p.pointsAwarded,
  };
}
