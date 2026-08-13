# Shoulder Rehab Physio-Tab Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the self-assembled shoulder prehab with Adham Khan's clinician-prescribed 7-exercise "Subscap Rehab", tracked as a 2–3×/week block whose per-exercise weight progression is persisted to Google Sheets.

**Architecture:** Adham's 7 exercises live in a new `shoulderrehab` section that is `daily: false` (shown, but excluded from the daily % because it's 2–3×/week, not daily). `belly-press-ir` and `side-lying-er` are removed from the `shoulders` section, leaving only the user's Pack + Pull ladders there. Completed sessions gain a `detail` payload — the shoulder-rehab done/total plus every logged weight — serialised into ONE new JSON `Detail` column appended to the existing Prehab sheet (existing 6 columns untouched, so old rows still parse). A weekly "X/3 this week" chip is computed from history.

**Tech Stack:** Frontend React + TypeScript + Vitest (`frontend/`); backend FastAPI + Pydantic + pytest with a Google Sheets store (`backend/`). No new dependencies.

## Global Constraints

- No new npm or pip dependencies.
- Frontend tests run with `cd frontend && npx vitest run`; backend tests with `cd backend && python -m pytest`.
- The 3 existing daily sheet columns (`Shoulders | Lower Back | Proprioception`), the `Total` and `Notes` columns, and their positions MUST stay byte-identical — old rows must keep parsing. New data goes in a single appended `Detail` column only.
- `SectionId` is a closed union; any new id must be added to the type AND to the `open` state object in `PrehabTab.tsx` (a `Record<SectionId, boolean>`), or the build breaks.
- Exercise `id`s are stable storage keys. New ids use the `sr-` prefix. Removing an id orphans its localStorage entry harmlessly (unused key, rolls over next day) — no migration flag needed.
- Match existing Tailwind/class conventions; do not restructure unrelated files.

---

### Task 1: Restructure prehab sections (data + section state)

**Files:**
- Modify: `frontend/src/data/prehabData.ts` (SectionId union; remove 2 shoulder cards; add `shoulderrehab` section)
- Modify: `frontend/src/components/PrehabTab.tsx:20-25` (add `shoulderrehab` to the `open` record)
- Test: `frontend/src/data/prehabData.test.ts`

**Interfaces:**
- Produces: a `PREHAB_SECTIONS` array whose ids are `["shoulderrehab","shoulders","lowerback","proprioception","assessment"]`; `shoulderrehab` has `daily: false` and 7 `loaded` exercises with ids `sr-prone-ha`, `sr-prone-l`, `sr-prone-t`, `sr-supine-rotation`, `sr-side-lying-er`, `sr-scaption`, `sr-banded-ir-90`; `shoulders` now holds only `closed-chain-progression` and `pull-ladder`.

- [ ] **Step 1: Rewrite the failing tests** in `frontend/src/data/prehabData.test.ts` — replace the whole file with:

```ts
import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "./prehabData";

describe("prehabData", () => {
  it("has shoulderrehab first, then the daily trio, then non-daily assessment", () => {
    expect(PREHAB_SECTIONS.map((s) => s.id)).toEqual([
      "shoulderrehab", "shoulders", "lowerback", "proprioception", "assessment",
    ]);
    expect(PREHAB_SECTIONS.filter((s) => s.daily !== false).map((s) => s.id)).toEqual([
      "shoulders", "lowerback", "proprioception",
    ]);
    expect(PREHAB_SECTIONS.find((s) => s.id === "shoulderrehab")!.daily).toBe(false);
    expect(PREHAB_SECTIONS.find((s) => s.id === "assessment")!.daily).toBe(false);
  });

  it("has 7 daily exercises (15 including shoulder-rehab + assessment)", () => {
    const daily = PREHAB_SECTIONS.filter((s) => s.daily !== false).reduce((n, s) => n + s.exercises.length, 0);
    const all = PREHAB_SECTIONS.reduce((n, s) => n + s.exercises.length, 0);
    expect(daily).toBe(7);
    expect(all).toBe(15);
  });

  it("has unique exercise ids", () => {
    const ids = PREHAB_SECTIONS.flatMap((s) => s.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every exercise has a valid kind and sets >= 1", () => {
    for (const s of PREHAB_SECTIONS) {
      for (const e of s.exercises) {
        expect(["loaded", "hold", "reps"]).toContain(e.kind);
        expect(e.sets).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("lower back still has 4 exercises incl. the 5-level back-extension progression", () => {
    const lb = PREHAB_SECTIONS.find((s) => s.id === "lowerback")!;
    expect(lb.exercises).toHaveLength(4);
    expect(lb.exercises[0].id).toBe("back-ext-progression");
    expect(lb.exercises[0].levels!.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("shoulders section (own additions only)", () => {
  const sh = PREHAB_SECTIONS.find((s) => s.id === "shoulders")!;
  it("holds only the Pack and Pull ladders", () => {
    expect(sh.exercises.map((e) => e.id)).toEqual(["closed-chain-progression", "pull-ladder"]);
  });
  it("pack and pull are still 3-level progressions", () => {
    for (const id of ["closed-chain-progression", "pull-ladder"]) {
      const prog = sh.exercises.find((e) => e.id === id)!;
      expect(prog.levels!.map((l) => l.level)).toEqual([1, 2, 3]);
    }
  });
});

describe("shoulderrehab section (Adham's prescription)", () => {
  const sr = PREHAB_SECTIONS.find((s) => s.id === "shoulderrehab")!;
  it("has the 7 prescribed exercises in order", () => {
    expect(sr.exercises.map((e) => e.id)).toEqual([
      "sr-prone-ha", "sr-prone-l", "sr-prone-t", "sr-supine-rotation",
      "sr-side-lying-er", "sr-scaption", "sr-banded-ir-90",
    ]);
  });
  it("all 7 are loaded, 3 sets, with a positive weight step", () => {
    for (const e of sr.exercises) {
      expect(e.kind).toBe("loaded");
      expect(e.sets).toBe(3);
      expect(e.weightStep ?? 0).toBeGreaterThan(0);
      expect(e.levels).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/data/prehabData.test.ts`
Expected: FAIL (old structure still present: order/counts/ids mismatch).

- [ ] **Step 3: Edit `prehabData.ts`**

3a. Extend the union (line 1):
```ts
export type SectionId = "shoulderrehab" | "shoulders" | "lowerback" | "proprioception" | "assessment";
```

3b. Remove the `belly-press-ir` and `side-lying-er` entries from the `shoulders` section's `exercises` array (lines 130-131), leaving `closed-chain-progression` and `pull-ladder` as the only two.

3c. Insert this section as the FIRST element of `PREHAB_SECTIONS` (before the `shoulders` object at line 125):
```ts
  {
    id: "shoulderrehab",
    label: "Shoulder Rehab",
    icon: "🩺",
    daily: false, // Adham's clinician block: 2–3×/wk, rest day between — shown but excluded from the daily %
    exercises: [
      { id: "sr-prone-ha", name: "Prone Horizontal Abduction", kind: "loaded", sets: 3, prescription: "10 reps · 1s hold", tags: ["prone", "arms out → arch overhead", "blades back+down"], note: "Adham · PhysiApp hjixuzwx · 2–3×/wk · add weight to progress", weightStep: 0.5 },
      { id: "sr-prone-l", name: "Prone L Raise (weighted ball)", kind: "loaded", sets: 3, prescription: "10 reps · 1s hold", tags: ["lower trap", "elbows to 90°", "palms face in"], weightStep: 0.5 },
      { id: "sr-prone-t", name: "Prone T Raise (weighted ball)", kind: "loaded", sets: 3, prescription: "10 reps · 1s hold", tags: ["mid trap", "palms forward", "squeeze blades"], weightStep: 0.5 },
      { id: "sr-supine-rotation", name: "Supine IR/ER @90°", kind: "loaded", sets: 3, prescription: "10 reps · 1s hold", tags: ["arm at 90°", "blades on floor", "control the weight"], weightStep: 1.25 },
      { id: "sr-side-lying-er", name: "Side-Lying ER", kind: "loaded", sets: 3, prescription: "10 reps · 1s hold", tags: ["good side down", "elbow tucked", "blades back+down"], weightStep: 1.25 },
      { id: "sr-scaption", name: "Scaption", kind: "loaded", sets: 3, prescription: "10 reps · 1s hold", tags: ["scapular plane", "no shrug", "control down"], weightStep: 1.25 },
      { id: "sr-banded-ir-90", name: "Banded IR @90°", kind: "loaded", sets: 3, prescription: "10 reps · 1s hold", tags: ["band tied behind you", "elbow at 90°", "blades back+down"], weightStep: 1.25 },
    ],
  },
```

3d. In `frontend/src/components/PrehabTab.tsx`, update the `open` initial state (lines 20-25) to include the new section (opened by default as the priority block):
```tsx
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    shoulderrehab: true,
    shoulders: false,
    lowerback: false,
    proprioception: false,
    assessment: false,
  });
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && npx vitest run src/data/prehabData.test.ts && npx tsc --noEmit`
Expected: PASS, and no type errors (confirms the `SectionId` union + `open` record line up).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/prehabData.ts frontend/src/data/prehabData.test.ts frontend/src/components/PrehabTab.tsx
git commit -m "feat(prehab): add Adham shoulder-rehab section, retire belly-press/side-lying"
```

---

### Task 2: Carry weights + shoulder-rehab progress in the completed-session payload

**Files:**
- Modify: `frontend/src/lib/prehabSession.ts` (add `PrehabDetail`, extend `LogEntry`, extend `buildLogEntry`)
- Modify: `frontend/src/api/gym.ts:180-203` (add `PrehabDetail`, extend `PrehabCompleteRequest` and `PrehabSession`)
- Test: `frontend/src/lib/prehabSession.test.ts` (new file)

**Interfaces:**
- Consumes: `sectionProgress`, `overallProgress`, `DayState` (already in `prehabSession.ts`); `"shoulderrehab"` section from Task 1.
- Produces: `interface PrehabDetail { shoulderrehab?: SectionProgress; weights: Record<string, string>; }`; `buildLogEntry` now returns a `detail: PrehabDetail`.

- [ ] **Step 1: Write the failing tests** — create `frontend/src/lib/prehabSession.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildLogEntry, DayState } from "./prehabSession";

const day = (entries: DayState["entries"]): DayState => ({ date: "2026-08-13", entries });

describe("buildLogEntry — detail payload", () => {
  it("collects only non-empty weights, keyed by exercise id", () => {
    const e = buildLogEntry(day({
      "sr-scaption": { setsDone: 3, weight: "5" },
      "sr-prone-l": { setsDone: 1, weight: "" },
      "sr-side-lying-er": { setsDone: 2 },
    }));
    expect(e.detail!.weights).toEqual({ "sr-scaption": "5" });
  });

  it("reports shoulder-rehab section progress", () => {
    const entries: DayState["entries"] = {};
    for (const id of ["sr-prone-ha", "sr-prone-l", "sr-prone-t", "sr-supine-rotation", "sr-side-lying-er", "sr-scaption", "sr-banded-ir-90"]) {
      entries[id] = { setsDone: 3 };
    }
    const e = buildLogEntry(day(entries));
    expect(e.detail!.shoulderrehab).toEqual({ done: 7, total: 7 });
  });

  it("keeps the daily sections list and total unchanged (shoulder-rehab excluded)", () => {
    const e = buildLogEntry(day({ "sr-scaption": { setsDone: 3, weight: "5" } }));
    expect(Object.keys(e.sections)).toEqual(["shoulders", "lowerback", "proprioception"]);
    expect(e.done).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/lib/prehabSession.test.ts`
Expected: FAIL (`e.detail` is undefined).

- [ ] **Step 3: Edit `prehabSession.ts`**

3a. Add the interface after `LogEntry` (after line 25):
```ts
export interface PrehabDetail {
  shoulderrehab?: SectionProgress;
  weights: Record<string, string>;
}
```

3b. Add `detail` to `LogEntry` (inside the interface at lines 19-25):
```ts
  detail?: PrehabDetail;
```

3c. Replace `buildLogEntry` (lines 71-77) with:
```ts
export function buildLogEntry(state: DayState, levels: Record<string, number> = {}): LogEntry {
  const sections = Object.fromEntries(
    PREHAB_SECTIONS.filter((s) => s.daily !== false).map((s) => [s.id, sectionProgress(s.id, state, levels)])
  ) as Record<SectionId, SectionProgress>;
  const overall = overallProgress(state, levels);
  const weights: Record<string, string> = {};
  for (const [exId, entry] of Object.entries(state.entries)) {
    if (entry.weight != null && entry.weight !== "") weights[exId] = entry.weight;
  }
  const detail: PrehabDetail = { shoulderrehab: sectionProgress("shoulderrehab", state, levels), weights };
  return { date: state.date, done: overall.done, total: overall.total, sections, notes: state.notes ?? "", detail };
}
```

3d. In `frontend/src/api/gym.ts`, add above `PrehabCompleteRequest` (line 197):
```ts
export interface PrehabDetail {
  shoulderrehab?: PrehabSectionProgress;
  weights: Record<string, string>;
}
```
and add `detail?: PrehabDetail;` as the last field of both `PrehabSession` (line 185-191) and `PrehabCompleteRequest` (line 197-203).

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && npx vitest run src/lib/prehabSession.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors (`buildLogEntry(...) as PrehabCompleteRequest` in `usePrehabSession.ts:33` still type-checks because both now carry `detail`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/prehabSession.ts frontend/src/lib/prehabSession.test.ts frontend/src/api/gym.ts
git commit -m "feat(prehab): carry weights + shoulder-rehab progress in the session detail payload"
```

---

### Task 3: Persist the detail payload to a new Sheets `Detail` column (backend)

**Files:**
- Modify: `backend/models.py:162-184` (add `PrehabDetail`; add `detail` to request + session)
- Modify: `backend/prehab.py` (JSON `Detail` column: header, serialise, parse)
- Test: `backend/test_prehab.py`

**Interfaces:**
- Consumes: `PrehabSectionProgress` (existing).
- Produces: `PrehabDetail(shoulderrehab: PrehabSectionProgress | None, weights: dict[str, str])`; `prehab_row` emits a 7th cell; `parse_prehab_row` reads it back; both request and session models carry `detail: PrehabDetail | None`.

- [ ] **Step 1: Write the failing tests** — edit `backend/test_prehab.py`:

1a. Update `test_prehab_row_serializes_in_order` to expect the trailing (empty) Detail cell:
```python
def test_prehab_row_serializes_in_order():
    assert prehab.prehab_row(_req()) == ["2026-06-29", "4/4", "3/3", "1/1", "8/8", "", ""]
```

1b. Update the two `save` tests' expected rows to add the trailing `""`:
```python
    assert appended == [["2026-06-29", "4/4", "3/3", "1/1", "8/8", "", ""]]
```
```python
    assert [w["value"] for w in writes] == ["2026-06-29", "4/4", "3/3", "1/1", "8/8", "", ""]
```

1c. Append new tests:
```python
def test_prehab_row_serializes_detail_json():
    from models import PrehabDetail
    req = _req(date="2026-08-13")
    req.detail = PrehabDetail(
        shoulderrehab=PrehabSectionProgress(done=6, total=7),
        weights={"sr-scaption": "5", "sr-side-lying-er": "4"},
    )
    row = prehab.prehab_row(req)
    assert row[6] == '{"shoulderrehab":{"done":6,"total":7},"weights":{"sr-scaption":"5","sr-side-lying-er":"4"}}'


def test_parse_prehab_row_reads_detail_roundtrip():
    from models import PrehabDetail
    req = _req(date="2026-08-13")
    req.detail = PrehabDetail(shoulderrehab=PrehabSectionProgress(done=7, total=7), weights={"sr-scaption": "6"})
    s = prehab.parse_prehab_row(prehab.prehab_row(req))
    assert s is not None
    assert s.detail is not None
    assert (s.detail.shoulderrehab.done, s.detail.shoulderrehab.total) == (7, 7)
    assert s.detail.weights == {"sr-scaption": "6"}


def test_parse_legacy_row_without_detail_column():
    # Rows written before the Detail column parse with detail=None.
    s = prehab.parse_prehab_row(["2026-06-29", "4/4", "3/3", "1/1", "8/8", "note"])
    assert s is not None
    assert s.notes == "note"
    assert s.detail is None
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python -m pytest test_prehab.py -q`
Expected: FAIL (row has 6 cells, no `detail`, `PrehabDetail` missing).

- [ ] **Step 3: Edit `models.py`** — add after `PrehabSectionProgress` (line 165):

```python
class PrehabDetail(BaseModel):
    shoulderrehab: PrehabSectionProgress | None = None
    weights: dict[str, str] = {}
```
and add `detail: PrehabDetail | None = None` as the last field of `PrehabCompleteRequest` and of `PrehabSession`.

- [ ] **Step 4: Edit `prehab.py`**

4a. Add `import json` at the top and extend the imports on line 8:
```python
import json
import sheets_client
from models import PrehabCompleteRequest, PrehabSession, PrehabSectionProgress, PrehabDetail
```

4b. Extend the header (line 12):
```python
PREHAB_HEADER = ["Date", "Shoulders", "Lower Back", "Proprioception", "Total", "Notes", "Detail"]
```

4c. Add two helpers and wire them in. Append the detail cell in `prehab_row` (after `cells.append(req.notes)` at line 26):
```python
    cells.append(_detail_to_cell(req.detail))
    return cells


def _detail_to_cell(detail: PrehabDetail | None) -> str:
    if detail is None:
        return ""
    payload: dict = {}
    if detail.shoulderrehab is not None:
        payload["shoulderrehab"] = {"done": detail.shoulderrehab.done, "total": detail.shoulderrehab.total}
    if detail.weights:
        payload["weights"] = detail.weights
    return json.dumps(payload, separators=(",", ":")) if payload else ""


def _parse_detail(cell: str) -> PrehabDetail | None:
    if not cell:
        return None
    try:
        data = json.loads(cell)
    except (ValueError, TypeError):
        return None
    sr = data.get("shoulderrehab")
    shoulderrehab = PrehabSectionProgress(done=int(sr["done"]), total=int(sr["total"])) if sr else None
    weights = {str(k): str(v) for k, v in (data.get("weights") or {}).items()}
    return PrehabDetail(shoulderrehab=shoulderrehab, weights=weights)
```
(Remove the now-duplicate `return cells` that previously ended `prehab_row`.)

4d. Read the detail column in `parse_prehab_row` (add before the return at line 46, and pass it):
```python
    detail = _parse_detail(_safe_get(row, 3 + len(SECTION_ORDER)))
    return PrehabSession(date=date, done=total.done, total=total.total, sections=sections, notes=notes, detail=detail)
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd backend && python -m pytest test_prehab.py -q`
Expected: PASS (all, including the legacy-row and endpoint tests).

- [ ] **Step 6: Commit**

```bash
git add backend/models.py backend/prehab.py backend/test_prehab.py
git commit -m "feat(prehab): persist shoulder-rehab progress + weights in a Detail JSON column"
```

---

### Task 4: Weekly adherence chip + enable Complete on shoulder-rehab-only days (UI)

**Files:**
- Modify: `frontend/src/lib/prehabSession.ts` (add `weekStartMonday`, `shoulderRehabThisWeek`)
- Modify: `frontend/src/components/PrehabTab.tsx` (chip + fix the Complete-button enable condition)
- Test: `frontend/src/lib/prehabSession.test.ts` (append)

**Interfaces:**
- Consumes: `LogEntry[]` (history, now carrying `detail`), `sectionProgress` (existing).
- Produces: `weekStartMonday(dateStr): string`; `shoulderRehabThisWeek(log: LogEntry[], today: string): number`.

- [ ] **Step 1: Write the failing tests** — append to `frontend/src/lib/prehabSession.test.ts`:

```ts
import { weekStartMonday, shoulderRehabThisWeek, LogEntry } from "./prehabSession";

describe("shoulder-rehab weekly count", () => {
  it("weekStartMonday returns the Monday of that week", () => {
    expect(weekStartMonday("2026-08-13")).toBe("2026-08-10"); // Thu → Mon 10 Aug
  });

  it("counts distinct in-week days where shoulder rehab was done", () => {
    const mk = (date: string, done: number): LogEntry => ({
      date, done: 0, total: 0, sections: {} as any,
      detail: { shoulderrehab: { done, total: 7 }, weights: {} },
    });
    const log = [
      mk("2026-08-10", 7), // Mon, done
      mk("2026-08-12", 3), // Wed, partial but done>0
      mk("2026-08-11", 0), // Tue, not done
      mk("2026-08-09", 7), // prev-week Sun, excluded
    ];
    expect(shoulderRehabThisWeek(log, "2026-08-13")).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/lib/prehabSession.test.ts`
Expected: FAIL (`weekStartMonday`/`shoulderRehabThisWeek` not exported).

- [ ] **Step 3: Add the helpers** to `prehabSession.ts` (end of file):

```ts
export function weekStartMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function shoulderRehabThisWeek(log: LogEntry[], today: string): number {
  const start = weekStartMonday(today);
  return log.filter(
    (e) => e.date >= start && e.date <= today && (e.detail?.shoulderrehab?.done ?? 0) > 0
  ).length;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npx vitest run src/lib/prehabSession.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the UI** in `PrehabTab.tsx`

5a. Extend the import on line 5:
```tsx
import { overallProgress, sectionProgress, activeExercise, shoulderRehabThisWeek } from "../lib/prehabSession";
```

5b. After `const pct = ...` (line 39) add:
```tsx
  const srToday = sectionProgress("shoulderrehab", day, levels);
  const srWeek = shoulderRehabThisWeek(log, day.date);
  const hasProgress = overall.done > 0 || srToday.done > 0;
```

5c. Immediately after the overall-progress `</div>` block (after line 77) add the chip:
```tsx
      <div className="mb-4 -mt-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-lg bg-gray-800/60 text-gray-300">
          🩺 Shoulder rehab: <span className="tabular-nums">{srWeek}/3</span> this week
          {srToday.done > 0 && <span className="text-gray-500"> · today {srToday.done}/{srToday.total}</span>}
        </span>
      </div>
```

5d. Fix the Complete button so a shoulder-rehab-only day can still be saved (its weights live in `detail`). Change line 111 `disabled={overall.done === 0 || isSaving}` to `disabled={!hasProgress || isSaving}`, and in the className ternary (lines 115-116) change both `overall.done === 0 || isSaving` occurrences to `!hasProgress || isSaving`.

- [ ] **Step 6: Verify build + full frontend suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS (type check clean; all vitest specs green).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/prehabSession.ts frontend/src/lib/prehabSession.test.ts frontend/src/components/PrehabTab.tsx
git commit -m "feat(prehab): weekly shoulder-rehab chip + allow saving rehab-only days"
```

---

### Task 5: Full verification + deploy check

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Run: `cd backend && python -m pytest -q`
Expected: all green.

- [ ] **Step 2: Build the frontend**

Run: `cd frontend && npm run build`
Expected: clean production build.

- [ ] **Step 3: Manual smoke (local)** — start the app, open the Prehab tab, confirm:
  - "Shoulder Rehab" section shows first, open, with 7 loaded cards (weight adjuster + 3 set ticks each), and the daily % bar does NOT include them.
  - Logging a weight on a shoulder-rehab card, ticking a set, then "Complete Session" saves without error even if no daily-section cards were touched.
  - The "🩺 Shoulder rehab: X/3 this week" chip renders.

- [ ] **Step 4: Deploy + confirm** (per the standard workflow: push, wait ~3 min for Render, then verify the live endpoint).

Run: `git push`
Then: after ~3 minutes, `curl -s https://<render-app>/api/prehab/history?limit=1` returns 200 and, once a session with detail has been saved from the deployed UI, the returned session includes a `detail` object. A previously-saved (legacy) row still returns with `detail: null` — confirming backward compatibility.

- [ ] **Step 5: Update the Prehab Google Sheet header** — the backend auto-writes the header only to an *empty* tab. The existing "Prehab" tab already has 6 columns, so add a 7th header cell **"Detail"** in column G manually (data rows self-populate on the next save). No data migration needed; existing rows read as `detail: null`.

---

## Self-Review

**Spec coverage:** Adham's 7 exercises → Task 1 ✓. Retire belly-press-ir (and side-lying-er, folded into the 7) → Task 1 ✓. Keep Pack + Pull → Task 1 (left in `shoulders`) ✓. Tier 3 weight persistence → Tasks 2+3 ✓. Cadence handling (daily:false + weekly chip) → Tasks 1+4 ✓. Backward-compatible sheet → Task 3 (appended column, legacy-row test) ✓.

**Placeholder scan:** none — every step has concrete code.

**Type consistency:** `PrehabDetail` shape matches across `prehabSession.ts`, `gym.ts`, and `models.py` (`shoulderrehab?: SectionProgress`, `weights: Record<string,string>`). JSON key is `shoulderrehab` (matches the section id) on both sides. `SectionId` union gains `"shoulderrehab"` and the `open` record is updated in lockstep (Task 1). `buildLogEntry` return type (`LogEntry` with `detail`) is compatible with the `as PrehabCompleteRequest` cast because `gym.ts` gains the same `detail` field.
