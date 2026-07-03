---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-04-24T00:59:48+08:00
files_modified:
  - src/app/child/(tabs)/_layout.tsx
  - src/app/child/(tabs)/tasks.tsx
  - src/app/child/(tabs)/rewards.tsx
  - src/app/child/(tabs)/me.tsx
  - src/app/child/(tabs)/notif.tsx
  - src/app/parent/(tabs)/_layout.tsx
  - src/app/parent/(tabs)/tasks.tsx
  - src/hooks/useAuth.ts
  - src/design/tokens.ts
  - src/design/Text.tsx
  - src/design/Starfield.tsx
  - docs/ui-spec-c2.md
  - firestore.rules
  - functions/src/grantPoints.ts
---

## Working on: Phase 1 complete — UI reskin Direction C "Night Sky"

### Summary

Executing the 8-phase UI reskin plan for Mission for Kids app (Direction C "Night Sky" — deep blue `#1E2547` palette). Phase 1 is complete: design tokens aligned, 4-tab child layout fixed, Firestore familyId security bugs fixed, useAuth try/catch added, snapshot race guard added. TypeScript passes clean (`npx tsc --noEmit` 0 errors), coderabbit and codex reviews completed, simulator confirmed correct tab order and visual.

### Decisions Made

- **Direction C confirmed**: Single `#1E2547` deep blue across all screens, no palette switching
- **4-tab child layout**: tasks(✦) → rewards(♡) → notif(◉) → me(☽). Deleted ai.tsx and points.tsx tabs
- **Firestore fix**: taskInstances queries must include `where('familyId', '==', familyId)` because security rules call `isFamilyMember(resource.data.familyId)` which requires equality filter
- **useAuth.ts**: `directDoc.exists()` is a method in RNFB v24 (was property access causing TS2774 error)
- **Snapshot race guard**: `snapshotGen` ref increments on each snapshot; only applies result if `gen === snapshotGen.current`
- **Font strategy**: NotoSerifTC + NotoSansTC for Chinese text (Nunito has no CJK). DM Sans for numbers. Serves same aesthetic role as spec's Nunito
- **Canonical spec**: `docs/ui-spec-c2.md` — full translation of screens_c2.jsx prototype. All phases reference this
- **Codex CLI 0.120.0 stdin deadlock**: Use `codex exec` with embedded file content, not `codex review` (diff too large + bug)
- **URGENT**: OPENAI_API_KEY exposed in terminal — must rotate at platform.openai.com/api-keys

### Remaining Work

1. **[Phase 2] Child Tasks screen** — Full implementation per `docs/ui-spec-c2.md` §3.1:
   - Progress ring/arc at top (animated, shows X/total)
   - Task cards with emoji, points chip, status rail colors
   - Section headers: 要做的 / 等爸媽看 / 完成了
   - Empty state with `<Empty />` component
   - CelebrationOverlay on approval (already wired in tasks.tsx)

2. **[Phase 2] Child Rewards screen** — per `docs/ui-spec-c2.md` §3.2:
   - Grid layout of reward cards (2-column)
   - Points balance pill at top
   - "兌換" button → order flow (child/order/[id].tsx)
   - Locked/unlocked state based on wallet balance vs reward cost

3. **[Phase 3a] Task Detail screen** — child/task/[id].tsx:
   - Show task description, points, photo upload zone
   - Camera via expo-image-picker, upload to Firebase Storage
   - "完成了！" submit button → sets status to submitted

4. **[Phase 3b] Celebration / result screen** — after submission
   - CelebrationOverlay already exists as component — needs full page version

5. **[Phase 4] Me screen** — src/app/child/(tabs)/me.tsx:
   - Avatar, kid name, wallet balance
   - Achievement placeholders (coming soon)
   - Points history (approved task instances)

6. **[Phase 4] Notifications screen** — src/app/child/(tabs)/notif.tsx:
   - Currently just a placeholder
   - Show approved/rejected task notifications

7. **[Phase 5] Parent Tasks screen** — already partially built, needs:
   - 48h auto-approve countdown per task
   - Swipe to approve/reject UI

8. **[Phase 5] Parent Review screen** — needs submitted task photo display

9. **[Phase 6] Parent Rewards/Settings/Notifications** — 5-tab parent layout

10. **[Phase 7] EAS Build + TestFlight** — full integration test

### Notes

- **Firestore rules hardening deferred**: `isFamilyMember` should check `status == 'active'`; `familyMemberships` read rule is too broad (`if isSignedIn()`)
- **Code fixes still pending**:
  - `child/order/[id].tsx`: "我拿到了" button shows for `approved` status (should only show for `delivered`)
  - `Task` type missing `graceDays: number`
  - `RewardItem` type missing `emoji: string | null`
- **Simulator device**: iPhone 17 Pro B4436202-581F-4922-8D3A-B2CAA91273DE
- **All design spec**: `docs/ui-spec-c2.md` is the canonical reference — derived from screens_c2.jsx + prototype_child2.jsx + prototype_parent2.jsx
- **EAS Build**: Use `eas build --platform ios --profile preview` — takes 15-20 min. Don't wait on CLI
- **Firebase project**: mission-for-kids, region asia-east1 (Firestore), us-central1 (Functions)
