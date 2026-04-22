# Core-loop directions — plan

## Three directions

**A · Warm Flat textbook** (conservative — follows DESIGN.md exactly)
- Hero task card dominates child home; parent review is a tidy triage list
- Amber ★ is the only visual reward token
- Illustrations: flat geometric circle-square-triangle constructions, no faces
- Owl mascot ("Pip") lives in a small corner badge during AI review
- Feels like: Duolingo + storybook textbook

**B · Editorial Playbook** (middle — respects tokens, rearranges layout)
- Child home = magazine-style list: today's date as big editorial masthead, tasks as indexed rows ("01 · 整理書桌")
- Parent review = card stack with swipe affordance + batch rail
- Adds serif-ish accents via Nunito 800 italic-substitute (still DESIGN.md-compliant)
- Owl mascot = full sidekick inside camera screen, reacts to capture
- Feels like: a gentle family newsletter

**C · Night Sky / tactile rebel** (rebellious — breaks some rules)
- **Breaks:** allows a deep night-indigo hero on celebration + camera screens (not cream); star constellation metaphor even though user said "only numbers + ★"; larger radii on celebration
- Child home stays cream, but the reward moment goes FULL-SCREEN indigo with stars filling a sky
- Parent review: dense data-forward, tabular-nums everywhere, almost spreadsheet-feeling
- Owl mascot = line-art, perched on UI chrome as a fixed companion
- Feels like: a late-night study app × children's observatory

## 10-screen map (same across all directions)

| # | Screen | Role |
|---|---|---|
| 01 | Home · Tasks | child |
| 02 | Task detail / accept | child |
| 03 | Camera + capture | child |
| 04 | AI reviewing (owl mascot) | child |
| 05 | Pending stars + waiting | child |
| 06 | Celebration (stars awarded) | child |
| 07 | Reward store | child |
| 08 | Reward order progress | child |
| 09 | Parent assign task | parent |
| 10 | Parent review queue | parent |

## Tweaks
- direction (A/B/C) — cycles the palette/layout for the visible screen
- role (child/parent) — shows child screens 01–08 or parent 09–10
- load (full/light) — "today very busy" vs "nothing to do" variations
- motion (on/reduce) — kills celebration animation
- lang (zh/en/both)

## File structure
- `core_loop/index.html` — entry, Tweaks panel, direction router
- `core_loop/tokens.js` — palette/type overrides per direction
- `core_loop/shared.jsx` — Phone chrome, OwlMascot, GeomIcon, useI18n
- `core_loop/screens_a.jsx`, `screens_b.jsx`, `screens_c.jsx`
- `core_loop/data.js` — sample tasks, rewards, family
