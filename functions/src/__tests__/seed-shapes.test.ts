import {
  buildParentUserDoc,
  buildFamilyDoc,
  buildParentMembership,
  buildChildUserDoc,
  buildChildMembership,
  buildChildWallet,
  buildTaskInstance,
} from '../devSeed/shapes';

// Locks the dev seed shapes to the authoritative onCall functions. If acceptFamilyInvite
// or bootstrapParentAccount changes its document shape, update the builder AND this test
// together — that is the drift guard codex asked for (#4 / #11).

const keys = (o: object) => Object.keys(o).sort();
const NOW = '<<ts>>';

describe('dev seed shapes mirror authoritative functions', () => {
  // ── parent ← bootstrapParentAccount.ts ─────────────────────────────────────
  it('parent user doc matches bootstrapParentAccount users/{uid}', () => {
    const doc = buildParentUserDoc({ uid: 'dev-parent', displayName: 'P', email: 'p@mfk.test', now: NOW });
    expect(keys(doc)).toEqual(
      ['authProvider', 'authProviderId', 'avatarUrl', 'birthday', 'createdAt', 'displayName', 'email', 'roleType'].sort()
    );
    expect(doc.roleType).toBe('parent');
    expect(doc.authProvider).toBe('password');
    expect(doc.authProviderId).toBe('dev-parent');
  });

  it('family doc matches bootstrapParentAccount families/{id}', () => {
    const doc = buildFamilyDoc({ displayName: 'Fam', createdBy: 'dev-parent', now: NOW });
    expect(keys(doc)).toEqual(['createdAt', 'createdBy', 'defaultGraceDays', 'displayName'].sort());
    expect(doc.defaultGraceDays).toBe(2);
  });

  it('parent membership matches bootstrapParentAccount familyMemberships/{uid}_{familyId}', () => {
    const doc = buildParentMembership({ familyId: 'fam', uid: 'dev-parent', now: NOW });
    expect(keys(doc)).toEqual(['familyId', 'invitedBy', 'joinedAt', 'role', 'status', 'userId'].sort());
    expect(doc.role).toBe('parent');
    expect(doc.status).toBe('active');
  });

  // ── child ← acceptFamilyInvite.ts ──────────────────────────────────────────
  it('child user doc matches acceptFamilyInvite users/{uid} (childId == uid)', () => {
    const doc = buildChildUserDoc({ uid: 'dev-kid1', displayName: 'K', email: 'k@mfk.test', now: NOW });
    expect(keys(doc)).toEqual(
      ['authProvider', 'authProviderId', 'avatarUrl', 'birthday', 'childId', 'createdAt', 'displayName', 'email', 'roleType'].sort()
    );
    expect(doc.roleType).toBe('child');
    expect(doc.childId).toBe('dev-kid1');
    expect(doc.authProviderId).toBe('dev-kid1');
  });

  it('child membership matches acceptFamilyInvite familyMemberships/{uid}_{familyId}', () => {
    const doc = buildChildMembership({
      familyId: 'fam', uid: 'dev-kid1', invitedBy: 'dev-parent', nickname: 'n', avatarEmoji: '🦊', now: NOW,
    });
    expect(keys(doc)).toEqual(
      ['avatarEmoji', 'childId', 'familyId', 'invitedBy', 'joinedAt', 'nickname', 'role', 'status', 'userId'].sort()
    );
    expect(doc.role).toBe('child');
    expect(doc.childId).toBe('dev-kid1');
    expect(doc.userId).toBe('dev-kid1');
  });

  it('child wallet matches acceptFamilyInvite pointWallets/{familyId}_{childId}', () => {
    const doc = buildChildWallet({ familyId: 'fam', uid: 'dev-kid1', balance: 8, now: NOW });
    expect(keys(doc)).toEqual(['balance', 'childId', 'familyId', 'updatedAt', 'userId'].sort());
    expect(doc.childId).toBe('dev-kid1');
    expect(doc.userId).toBe('dev-kid1');
  });

  // ── taskInstance: must carry childId for child page read (codex #6) ─────────
  it('taskInstance carries childId (== uid) so child task page query is non-empty', () => {
    const doc = buildTaskInstance({
      taskId: 't', uid: 'dev-kid1', familyId: 'fam',
      periodStart: NOW, periodEnd: NOW, gracePeriodEnd: NOW,
      status: 'pending', submissionCount: 0, reviewedBy: null, reviewedAt: null, pointsAwarded: null,
    });
    expect(keys(doc)).toEqual(
      ['childId', 'familyId', 'gracePeriodEnd', 'periodEnd', 'periodStart', 'pointsAwarded', 'reviewedBy', 'reviewedAt', 'status', 'submissionCount', 'taskId', 'userId'].sort()
    );
    expect(doc.childId).toBe('dev-kid1');
    expect(doc.userId).toBe('dev-kid1');
  });
});
