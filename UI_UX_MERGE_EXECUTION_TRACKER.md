## AqwaValley UI/UX Merge Execution Tracker

Status legend: `[ ]` not started, `[-]` in progress, `[x]` completed.

### Phase A: Foundation (Step 1)

- [x] A1. Add motion tokens file
  - Target: `src/lib/motion.ts` (new)
  - Commit: `uiux(step1): add shared motion presets and variants`

- [x] A2. Extend radius token system safely
  - Target: `src/styles/globals.css` in `@theme` radius block
  - Patch anchor: existing `--radius-sm`, `--radius-md`, `--radius-lg`
  - Commit: `uiux(step1): extend global radius tokens`

- [x] A3. Add missing animation/keyframe utilities
  - Target: `src/styles/globals.css` after existing global keyframes
  - Patch anchor: after `@keyframes fadeSlideDown` and before map enhancements
  - Includes:
    - `heartbeat`
    - `pulse-ring`
    - `progress-water`
    - utility classes `glass-header`, `table-row-hover`, `badge-animate`, `zone-active-glow`, `glass-panel`
  - Commit: `uiux(step1): add reusable animation and surface utilities`

- [x] A4. Validate foundation changes
  - Commands:
    - `pnpm typecheck`
    - `pnpm lint`
  - Commit: none

### Phase B: High-ROI Demo Features (Next)

- [ ] B1. Irrigate page tactile interaction package
  - Target: `src/app/(farm)/farm/irrigate/_components/IrrigateClient.tsx`

- [ ] B2. AI Plan centerpiece entrance and confidence pulse
  - Target: `src/app/(farm)/farm/ai-plan/_components/AiPlanClient.tsx`

- [ ] B3. Map overlay and pulsing marker rings
  - Targets:
    - `src/app/_components/UI/leaflet-map.tsx`
    - `src/app/(gov)/dashboard/_components/map-client.tsx`

### Phase C: Data/Modal Polish

- [ ] C1. Table sticky header and hover lift
  - Targets:
    - `src/app/(farm)/farm/history/_components/irrigation-history-table.tsx`
    - `src/app/(farm)/farm/quota/_components/quota-history-table.tsx`

- [ ] C2. Users modal/dropdown spring wrappers
  - Targets:
    - `src/app/(gov)/users/_components/users-motion-components.tsx` (new)
    - `src/app/(gov)/users/_components/users-page-client.tsx`

- [ ] C3. Skeleton system and loading routes
  - Targets:
    - `src/app/_components/UI/Skeleton.tsx`
    - `src/app/(farm)/farm/ai-plan/loading.tsx`
    - `src/app/(farm)/farm/history/loading.tsx`
    - `src/app/(farm)/farm/quota/loading.tsx`

### Phase D: Global Sweeps and Gate

- [ ] D1. Global `whileTap` sweep
  - Scope: farm and gov pages

- [ ] D2. Radius normalization sweep
  - Scope: touched components only first pass

- [ ] D3. Final gate checks
  - Commands:
    - `pnpm typecheck`
    - `pnpm lint`
  - Manual smoke:
    - AI plan generation flow
    - Irrigate start/stop interaction
    - Gov map marker overlay
    - Users modal and confirm flow
    - History/quota table scroll behavior
