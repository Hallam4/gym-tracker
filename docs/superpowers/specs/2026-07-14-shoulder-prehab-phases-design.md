# Shoulder Prehab Phased Programme — Design

**Date:** 2026-07-14
**Scope:** Daily Prehab tab, Shoulders section only. Frontend-only change.
**Decided with user:** eras-with-carryover phase model; phase-aware section implementation; pack ladder runs in full from Phase 1 (user overrode the park/cap recommendation).

## Context

The Shoulders prehab section is a flat list of 7 exercises (evidence-rebuilt 12 Jul 2026, v0.147–0.149). The adopted LBA sequencing — *short-range cuff squeezes first (long time) → stretch-loaded → pack/pull* — exists only as prose in memory/notes. This change encodes it as a 3-phase programme in the app.

Naming: **Phases 1–3** are shoulder-programme eras. **Ladder Levels 1–5** are per-exercise progressions (pack ladder, back-extension). Neither relates to the U1/U2/L1/L2 workout split, which this change does not touch. UI copy must always say "Phase N" / "Level N of 5" in full.

## Programme content

The **Closed-Chain Pack ladder is phase-independent**: visible and advanceable in every phase, own dwell rules (≥4–6 weeks/level), Level 5 (graded overhead) stays gated on being symptom/apprehension-free. The phases govern the squeeze → stretch-loaded → pull stream only.

### Phase 1 — "Short-Range Squeezes" (default)
| Exercise | Dose |
|---|---|
| Anterior Delt Isometric | 5×30–45s |
| Side-Lying ER (cap 45°) | 3×15 |
| Belly-Press IR | 3×12–15 |
| Band Pull-Apart / Face Pull | 2×12–15 |
| Rhythmic Stabilization | 3×20–30s |
| Closed-Chain Pack ladder | per ladder level |

Hidden: Scap-Plane Front Raise, Stretch-Loaded IR.
Advance-when (card copy): "8–12 weeks all-GREEN (no ache, no apprehension) and target doses feel easy."

### Phase 2 — "Stretch-Loaded"
New stimulus: Side-Lying ER uncapped to full *comfortable* range 3×12–15 (slow); Scap-Plane Front Raise 2×12–15; **Stretch-Loaded IR** (new exercise id `stretch-ir`: light dumbbell, arm supported, emphasis on the lengthened position) 2×12.
Maintenance carryover: Anterior Delt Iso 2×30s · Belly-Press IR 2×12 · Pull-Apart 1×15 · Rhythmic Stab 2×20s.
Pack ladder continues.
Advance-when: "4–6 weeks GREEN on full-range dumbbell work."

### Phase 3 — "Pack / Pull"
New stimulus: the Pull-Apart slot upgrades (same id `scap-retraction`, phase-dependent prescription) to a **C-scoop row progression** — band row → inverted row/TRX, short-range squeeze emphasis, 2–3×8–12.
Maintenance: Belly-Press IR 2×12 · Side-Lying ER 2×12 · Anterior Delt Iso 1×45s · Front Raise 1×12–15 · Stretch-Loaded IR 1×12 · Rhythmic Stab 2×20s.
Pack ladder continues (Level 5 gate unchanged).

### Safety rails (all phases, unchanged)
GREEN/AMBER/RED push/back-off rules; avoid-list (90/90 abd+ER, overhead loading, dead-hangs, empty-can); RED or a subluxation event = imaging/specialist trigger, not a training tweak. Phase advancement is always manual — the card shows entry criteria; the user decides.

## Implementation

### Data model (`frontend/src/data/prehabData.ts`)
- `PrehabSectionDef` gains optional `phases?: PrehabPhaseDef[]`; `PrehabPhaseDef = { phase: number; name: string; goal: string; advanceWhen: string }`. Only the shoulders section defines it (3 entries).
- `PrehabExercise` gains optional `phasePlan?: Record<number, PhaseDose | null>`; `PhaseDose = { sets: number; prescription: string; tags?: string[]; note?: string; maintenance?: boolean }`. Semantics: `null` → hidden in that phase; key present → override sets/prescription (`maintenance: true` drives the pill); **`phasePlan` absent → exercise is untouched by phases** (pack ladder, every non-shoulders section). An exercise that defines `phasePlan` must define **every** phase key explicitly (1, 2, 3) — no implicit fallback; a test enforces exhaustiveness against the section's `phases`.
- New exercise `stretch-ir` with `phasePlan` {1: null, 2: full, 3: maintenance}. All existing ids unchanged → localStorage tick/weight/ladder state survives.

### State (`frontend/src/hooks/usePrehabPhase.ts`, new)
Mirrors `usePrehabLevels`: localStorage key `gym-prehab-phase`, default 1, clamped to the section's defined phases (1–3). Advance/back via phase card with the same confirm affordance as ladder level changes.

### Logic (`frontend/src/lib/prehabSession.ts`)
- `phaseDose(exercise, phase): PhaseDose | "hidden" | "default"` resolver.
- Section rendering filters `"hidden"`; cards render override or default dose; done-threshold uses the *effective* set count.
- Known tradeoff carried over from levels, documented not fixed: set ticks are per-exercise-id, so changing phase mid-day can flip a card's done state.

### UI (`frontend/src/components/`)
- `PrehabPhaseCard.tsx` (new): rendered at top of a section that defines `phases` — shows "Phase N of 3: <name>", goal, advance-when, back/advance buttons.
- `PrehabExerciseCard`/`PrehabSection`: accept effective dose; render a small "maintenance" pill when the active `PhaseDose.maintenance` is true.

### Tests (`frontend/src/lib/prehabSession.test.ts`)
- `phaseDose` resolution: full / maintenance / hidden / absent-plan default.
- Clamp + default phase behaviour.
- Non-phased sections and the pack ladder unaffected at every phase.
- Done-threshold respects overridden set counts.

### Rollout
1. Version bump; deploy via Render auto-deploy from `master`.
2. Verify by grepping the live JS bundle for a new symbol (repo convention — `version.json` is SPA-rewritten and lies).
3. Post-ship: update the Apple Notes "Prehab Routine" pointer snapshot and the `shoulder-rehab-programme` / `health-plan` memory files so the paper trail matches the app.

## Non-goals
- No backend/Google Sheets changes; no changes to workout split (U1/U2/L1/L2), session logging, back-extension ladder, lower-back or proprioception sections.
- No automatic phase advancement, timers, or reminders.
- No fix for the pre-existing per-exercise-id tick tradeoff.

## Risks
- **Session length in Phases 2–3** grows (maintenance + new stimulus + ladder). Mitigation: maintenance doses kept to 1–2 sets; user can trim doses in data if sessions overrun.
- **Two visible progression systems** (phase card + ladder card) could confuse; mitigated by full-word UI copy ("Phase", "Level … of 5") and the maintenance pill.
- Rhythmic Stab retained through Phase 3 even though pack ladder Level 4 adds perturbation — deliberate redundancy, cheap (2×20s).
