# Prehab Backend Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist completed prehab sessions to a dedicated `Prehab` Google Sheet tab (via new backend endpoints) instead of localStorage, while keeping in-progress state local.

**Architecture:** New `backend/prehab.py` (pure row build/parse helpers + thin Sheets I/O, mirroring `history.py`) exposed via two FastAPI endpoints; new Pydantic models; frontend gains two `api` methods and rewires `usePrehabSession` so the completed-session log comes from a react-query query and "Complete" is a mutation. In-progress `day` state stays in localStorage.

**Tech Stack:** Python 3 + FastAPI + Pydantic + Google Sheets API (backend, pytest); React 18 + TypeScript + Vite + @tanstack/react-query (frontend, vitest).

## Global Constraints

- Backend tests run from the backend dir: `cd ~/gym-tracker/backend && python3 -m pytest <file> -v`.
- Frontend: `cd ~/gym-tracker/frontend && npm test` (vitest) and `npm run build` (`tsc && vite build`) must pass.
- Store: a dedicated tab named exactly `Prehab`. Row schema: `Date | Shoulders | Lower Back | Proprioception | Total`; section/total cells are `"done/total"`; `Date` is ISO `YYYY-MM-DD`.
- Section order is fixed: `["shoulders", "lowerback", "proprioception"]`.
- Dedupe by date: saving for a date that already has a row overwrites it; otherwise append.
- `POST /api/prehab/complete` is protected by `X-API-Key` (`Depends(_require_api_key)`); `GET /api/prehab/history` is not.
- In-progress `day` stays in localStorage key `gym-prehab-v2-today`. The log key `gym-prehab-v2-log` is removed.
- Backend follows `history.py` conventions: `_safe_get`, try/except → `[]` on read, `_ensure_*_tab` writes the header when the tab is present-but-empty (the tab itself is created manually).
- Manual one-time setup (NOT a code task): add an empty tab named `Prehab` to the spreadsheet. The backend writes its header row automatically on first save.

---

### Task 1: Backend models + pure prehab helpers

**Files:**
- Modify: `backend/models.py` (append new models)
- Create: `backend/prehab.py` (constants + pure helpers only in this task)
- Test: `backend/test_prehab.py`

**Interfaces:**
- Produces: models `PrehabSectionProgress{done:int,total:int}`, `PrehabCompleteRequest{date:str,done:int,total:int,sections:dict[str,PrehabSectionProgress]}`, `PrehabSession{date,done,total,sections}`, `PrehabHistoryResponse{sessions:list[PrehabSession]}`; `prehab.PREHAB_TAB`, `prehab.PREHAB_HEADER`, `prehab.SECTION_ORDER`, `prehab.prehab_row(req)->list[str]`, `prehab.parse_prehab_row(row)->PrehabSession|None`, `prehab.find_row_index(rows,date)->int|None`.

- [ ] **Step 1: Add the Pydantic models**

Append to `backend/models.py`:
```python


class PrehabSectionProgress(BaseModel):
    done: int
    total: int


class PrehabCompleteRequest(BaseModel):
    date: str
    done: int
    total: int
    sections: dict[str, PrehabSectionProgress]


class PrehabSession(BaseModel):
    date: str
    done: int
    total: int
    sections: dict[str, PrehabSectionProgress]


class PrehabHistoryResponse(BaseModel):
    sessions: list[PrehabSession]
```

- [ ] **Step 2: Write the failing tests**

Create `backend/test_prehab.py`:
```python
"""Tests for prehab session serialization/parsing and persistence logic."""
import prehab
from models import PrehabCompleteRequest, PrehabSectionProgress


def _req(date="2026-06-29", sh=(4, 4), lb=(3, 3), pr=(1, 1), done=8, total=8):
    return PrehabCompleteRequest(
        date=date, done=done, total=total,
        sections={
            "shoulders": PrehabSectionProgress(done=sh[0], total=sh[1]),
            "lowerback": PrehabSectionProgress(done=lb[0], total=lb[1]),
            "proprioception": PrehabSectionProgress(done=pr[0], total=pr[1]),
        },
    )


def test_prehab_row_serializes_in_order():
    assert prehab.prehab_row(_req()) == ["2026-06-29", "4/4", "3/3", "1/1", "8/8"]


def test_parse_prehab_row_roundtrip():
    s = prehab.parse_prehab_row(prehab.prehab_row(_req(sh=(2, 4), done=6, total=8)))
    assert s is not None
    assert s.date == "2026-06-29"
    assert (s.done, s.total) == (6, 8)
    assert (s.sections["shoulders"].done, s.sections["shoulders"].total) == (2, 4)


def test_parse_prehab_row_header_and_blank_return_none():
    assert prehab.parse_prehab_row(prehab.PREHAB_HEADER) is None
    assert prehab.parse_prehab_row([]) is None
    assert prehab.parse_prehab_row(["", "", ""]) is None


def test_find_row_index_hit_and_miss():
    rows = [
        prehab.PREHAB_HEADER,
        ["2026-06-28", "1/1", "0/0", "0/0", "1/8"],
        ["2026-06-29", "4/4", "3/3", "1/1", "8/8"],
    ]
    assert prehab.find_row_index(rows, "2026-06-29") == 2
    assert prehab.find_row_index(rows, "2026-01-01") is None
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd ~/gym-tracker/backend && python3 -m pytest test_prehab.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'prehab'` (and/or import errors for the new models).

- [ ] **Step 4: Write the prehab helpers**

Create `backend/prehab.py`:
```python
"""Prehab session persistence — completed daily prehab summaries in the Prehab tab.

Mirrors history.py: pure row build/parse helpers plus thin Google Sheets I/O.
A row is: Date | Shoulders | Lower Back | Proprioception | Total, where each
section/total cell is "done/total". Dedup is by date (one row per day).
"""
import sheets_client
from models import PrehabCompleteRequest, PrehabSession, PrehabSectionProgress

PREHAB_TAB = "Prehab"
SECTION_ORDER = ["shoulders", "lowerback", "proprioception"]
PREHAB_HEADER = ["Date", "Shoulders", "Lower Back", "Proprioception", "Total"]


def _safe_get(row: list[str], idx: int) -> str:
    return row[idx].strip() if idx < len(row) else ""


def prehab_row(req: PrehabCompleteRequest) -> list[str]:
    """Serialize a completed session into a sheet row."""
    cells = [req.date]
    for sid in SECTION_ORDER:
        p = req.sections.get(sid) or PrehabSectionProgress(done=0, total=0)
        cells.append(f"{p.done}/{p.total}")
    cells.append(f"{req.done}/{req.total}")
    return cells


def _parse_pair(cell: str) -> PrehabSectionProgress:
    try:
        d, t = cell.split("/")
        return PrehabSectionProgress(done=int(d), total=int(t))
    except (ValueError, AttributeError):
        return PrehabSectionProgress(done=0, total=0)


def parse_prehab_row(row: list[str]) -> PrehabSession | None:
    """Parse a data row into a session; None for header/blank/malformed rows."""
    date = _safe_get(row, 0)
    if not date or date == "Date":
        return None
    sections = {sid: _parse_pair(_safe_get(row, i + 1)) for i, sid in enumerate(SECTION_ORDER)}
    total = _parse_pair(_safe_get(row, 1 + len(SECTION_ORDER)))
    return PrehabSession(date=date, done=total.done, total=total.total, sections=sections)


def find_row_index(rows: list[list[str]], date: str) -> int | None:
    """Index into the fetched rows (incl. header) whose Date cell == date, else None."""
    for i, row in enumerate(rows):
        if _safe_get(row, 0) == date:
            return i
    return None
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd ~/gym-tracker/backend && python3 -m pytest test_prehab.py -v`
Expected: 4 passed.

- [ ] **Step 6: Commit**
```bash
cd ~/gym-tracker
git add backend/models.py backend/prehab.py backend/test_prehab.py
git commit -m "feat(prehab): backend models + pure row serialize/parse helpers"
```

---

### Task 2: Backend Sheets I/O (read + dedup-save)

**Files:**
- Modify: `backend/prehab.py` (add `_ensure_prehab_tab`, `get_prehab_sessions`, `save_prehab_session`)
- Test: `backend/test_prehab.py` (add monkeypatch I/O tests)

**Interfaces:**
- Consumes: `prehab_row`, `parse_prehab_row`, `find_row_index`, `PREHAB_TAB`, `PREHAB_HEADER` (Task 1); `sheets_client.fetch_tab(tab)->list[list[str]]`, `sheets_client.append_rows(tab, rows)`, `sheets_client.write_cells(tab, updates)` where each update is `{"row":int(0-indexed),"col":int(0-indexed),"value":str}`.
- Produces: `get_prehab_sessions(limit:int=30)->list[PrehabSession]` (newest-first), `save_prehab_session(req)->None`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/test_prehab.py`:
```python


def test_get_prehab_sessions_orders_desc_and_limits(monkeypatch):
    rows = [
        prehab.PREHAB_HEADER,
        ["2026-06-27", "1/1", "0/0", "0/0", "1/8"],
        ["2026-06-29", "4/4", "3/3", "1/1", "8/8"],
        ["2026-06-28", "2/4", "0/0", "0/0", "2/8"],
    ]
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", lambda tab: rows)
    out = prehab.get_prehab_sessions(limit=2)
    assert [s.date for s in out] == ["2026-06-29", "2026-06-28"]


def test_get_prehab_sessions_empty_on_error(monkeypatch):
    def boom(tab):
        raise RuntimeError("no tab")
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", boom)
    assert prehab.get_prehab_sessions() == []


def test_save_prehab_session_appends_when_absent(monkeypatch):
    appended = []
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", lambda tab: [prehab.PREHAB_HEADER])
    monkeypatch.setattr(prehab.sheets_client, "append_rows", lambda tab, r: appended.extend(r))
    monkeypatch.setattr(prehab.sheets_client, "write_cells", lambda tab, u: (_ for _ in ()).throw(AssertionError("must not write_cells")))
    prehab.save_prehab_session(_req(date="2026-06-29"))
    assert appended == [["2026-06-29", "4/4", "3/3", "1/1", "8/8"]]


def test_save_prehab_session_overwrites_existing_date(monkeypatch):
    rows = [prehab.PREHAB_HEADER, ["2026-06-29", "1/4", "0/0", "0/0", "1/8"]]
    writes = []
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", lambda tab: rows)
    monkeypatch.setattr(prehab.sheets_client, "append_rows", lambda tab, r: (_ for _ in ()).throw(AssertionError("must not append")))
    monkeypatch.setattr(prehab.sheets_client, "write_cells", lambda tab, u: writes.extend(u))
    prehab.save_prehab_session(_req(date="2026-06-29"))
    assert {w["row"] for w in writes} == {1}
    assert [w["value"] for w in writes] == ["2026-06-29", "4/4", "3/3", "1/1", "8/8"]
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd ~/gym-tracker/backend && python3 -m pytest test_prehab.py -k "sessions or save" -v`
Expected: FAIL — `AttributeError: module 'prehab' has no attribute 'get_prehab_sessions'` / `save_prehab_session`.

- [ ] **Step 3: Add the I/O functions**

Append to `backend/prehab.py`:
```python


def _ensure_prehab_tab():
    """Write the header if the tab exists but is empty (tab created manually)."""
    try:
        rows = sheets_client.fetch_tab(PREHAB_TAB)
        if not rows:
            sheets_client.append_rows(PREHAB_TAB, [PREHAB_HEADER])
    except Exception:
        pass


def get_prehab_sessions(limit: int = 30) -> list[PrehabSession]:
    """All completed sessions, newest-first, capped at `limit`."""
    try:
        rows = sheets_client.fetch_tab(PREHAB_TAB)
    except Exception:
        return []
    sessions = [s for s in (parse_prehab_row(r) for r in rows) if s is not None]
    sessions.sort(key=lambda s: s.date, reverse=True)
    return sessions[:limit]


def save_prehab_session(req: PrehabCompleteRequest) -> None:
    """Overwrite today's row if present, else append. Dedup is by date."""
    _ensure_prehab_tab()
    rows = sheets_client.fetch_tab(PREHAB_TAB)
    row = prehab_row(req)
    i = find_row_index(rows, req.date)
    if i is not None:
        sheets_client.write_cells(PREHAB_TAB, [{"row": i, "col": c, "value": v} for c, v in enumerate(row)])
    else:
        sheets_client.append_rows(PREHAB_TAB, [row])
```

- [ ] **Step 4: Run the full prehab suite to verify it passes**

Run: `cd ~/gym-tracker/backend && python3 -m pytest test_prehab.py -v`
Expected: 8 passed.

- [ ] **Step 5: Commit**
```bash
cd ~/gym-tracker
git add backend/prehab.py backend/test_prehab.py
git commit -m "feat(prehab): backend read + dedup-save Sheets I/O"
```

---

### Task 3: Backend endpoints

**Files:**
- Modify: `backend/main.py` (imports + two endpoints)
- Test: `backend/test_prehab.py` (add TestClient tests)

**Interfaces:**
- Consumes: `prehab.get_prehab_sessions`, `prehab.save_prehab_session`; models `PrehabCompleteRequest`, `PrehabHistoryResponse`; existing `app`, `_require_api_key`, `_safe_error`, `HTTPException`.
- Produces: `POST /api/prehab/complete` → `{"status":"ok"}`; `GET /api/prehab/history?limit=` → `PrehabHistoryResponse`.

- [ ] **Step 1: Write the failing TestClient tests**

Append to `backend/test_prehab.py`:
```python


def test_get_prehab_history_endpoint(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    from models import PrehabSession, PrehabSectionProgress
    sess = PrehabSession(
        date="2026-06-29", done=8, total=8,
        sections={
            "shoulders": PrehabSectionProgress(done=4, total=4),
            "lowerback": PrehabSectionProgress(done=3, total=3),
            "proprioception": PrehabSectionProgress(done=1, total=1),
        },
    )
    monkeypatch.setattr(main.prehab, "get_prehab_sessions", lambda limit=30: [sess])
    res = TestClient(main.app).get("/api/prehab/history")
    assert res.status_code == 200
    body = res.json()
    assert body["sessions"][0]["date"] == "2026-06-29"
    assert body["sessions"][0]["sections"]["shoulders"]["done"] == 4


def test_complete_prehab_endpoint(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    captured = {}
    monkeypatch.setattr(main.prehab, "save_prehab_session", lambda req: captured.update(req=req))
    main.app.dependency_overrides[main._require_api_key] = lambda: None
    try:
        res = TestClient(main.app).post("/api/prehab/complete", json={
            "date": "2026-06-29", "done": 8, "total": 8,
            "sections": {
                "shoulders": {"done": 4, "total": 4},
                "lowerback": {"done": 3, "total": 3},
                "proprioception": {"done": 1, "total": 1},
            },
        })
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
        assert captured["req"].date == "2026-06-29"
    finally:
        main.app.dependency_overrides.clear()
```

- [ ] **Step 2: Run the endpoint tests to verify they fail**

Run: `cd ~/gym-tracker/backend && python3 -m pytest test_prehab.py -k "endpoint" -v`
Expected: FAIL — 404 (routes not registered) on both requests.

- [ ] **Step 3: Wire imports + endpoints in main.py**

In `backend/main.py`: add `import prehab` next to the existing `import history` / `import sheets_client` lines, and add `PrehabCompleteRequest, PrehabHistoryResponse` to the existing `from models import (...)` statement.

Then add these two endpoints immediately after the `get_history_session` endpoint (the `@app.get("/api/history/session/{date}/{day}", ...)` block):
```python
@app.post("/api/prehab/complete", response_model=dict, dependencies=[Depends(_require_api_key)])
async def complete_prehab(req: PrehabCompleteRequest):
    """Save a completed prehab session (overwrites today's row if present)."""
    try:
        prehab.save_prehab_session(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return {"status": "ok"}


@app.get("/api/prehab/history", response_model=PrehabHistoryResponse)
async def get_prehab_history(limit: int = 30):
    """Completed prehab sessions, newest-first."""
    try:
        sessions = prehab.get_prehab_sessions(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return PrehabHistoryResponse(sessions=sessions)
```

- [ ] **Step 4: Run the full prehab suite to verify it passes**

Run: `cd ~/gym-tracker/backend && python3 -m pytest test_prehab.py -v`
Expected: 10 passed.

- [ ] **Step 5: Commit**
```bash
cd ~/gym-tracker
git add backend/main.py backend/test_prehab.py
git commit -m "feat(prehab): POST /api/prehab/complete + GET /api/prehab/history"
```

---

### Task 4: Frontend API client methods

**Files:**
- Modify: `frontend/src/api/gym.ts`

**Interfaces:**
- Produces: `PrehabSectionProgress`, `PrehabSession`, `PrehabHistoryResponse`, `PrehabCompleteRequest` types; `api.getPrehabHistory(limit?)`, `api.completePrehab(data)`.

- [ ] **Step 1: Add types + methods**

In `frontend/src/api/gym.ts`, add these interfaces just above the `export const api = {` line:
```ts
export interface PrehabSectionProgress {
  done: number;
  total: number;
}

export interface PrehabSession {
  date: string;
  done: number;
  total: number;
  sections: Record<string, PrehabSectionProgress>;
}

export interface PrehabHistoryResponse {
  sessions: PrehabSession[];
}

export interface PrehabCompleteRequest {
  date: string;
  done: number;
  total: number;
  sections: Record<string, PrehabSectionProgress>;
}
```
Then add these two properties inside the `api` object (e.g. after `getStreaks`):
```ts
  getPrehabHistory: (limit = 30) =>
    fetchJSON<PrehabHistoryResponse>(`/api/prehab/history?limit=${limit}`),
  completePrehab: (data: PrehabCompleteRequest) =>
    postJSON<{ status: string }>("/api/prehab/complete", data),
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd ~/gym-tracker/frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**
```bash
cd ~/gym-tracker
git add frontend/src/api/gym.ts
git commit -m "feat(prehab): api client methods for prehab persistence"
```

---

### Task 5: Rewire usePrehabSession to the backend

**Files:**
- Modify: `frontend/src/hooks/usePrehabSession.ts` (full rewrite)
- Modify: `frontend/src/lib/prehabSession.ts` (remove `appendLog`)
- Modify: `frontend/src/lib/prehabSession.test.ts` (remove the `appendLog` test)

**Interfaces:**
- Consumes: `api.getPrehabHistory`, `api.completePrehab`, `PrehabCompleteRequest` (Task 4); `DayState`, `LogEntry`, `emptyDayState`, `rollIfNewDay`, `buildLogEntry` (lib); `@tanstack/react-query`.
- Produces: `usePrehabSession()` returning `{ day, log, setSetsDone, setWeight, completeSession, isSaving, isSaved, saveError }` where `log: LogEntry[]`, `isSaving`/`isSaved`/`saveError: boolean`.

- [ ] **Step 1: Remove `appendLog` from the lib**

In `frontend/src/lib/prehabSession.ts`, delete the entire `appendLog` function:
```ts
export function appendLog(log: LogEntry[], entry: LogEntry): LogEntry[] {
  return [entry, ...log.filter((e) => e.date !== entry.date)];
}
```
Leave `buildLogEntry` and all other exports unchanged. (`buildLogEntry` is now the request-payload builder.)

- [ ] **Step 2: Remove the `appendLog` test**

In `frontend/src/lib/prehabSession.test.ts`, delete the `appendLog` import usage and the test:
```ts
  it("appendLog prepends and dedupes by date", () => {
    ...
  });
```
Also remove `appendLog` from the import line at the top of that test file (keep the other imports).

- [ ] **Step 3: Run vitest to verify the suite is green without the removed test**

Run: `cd ~/gym-tracker/frontend && npm test`
Expected: PASS — 11 tests now (was 12; the one `appendLog` test is gone). No "appendLog is not defined" errors.

- [ ] **Step 4: Rewrite the hook**

Replace the entire contents of `frontend/src/hooks/usePrehabSession.ts` with:
```ts
import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PrehabCompleteRequest } from "../api/gym";
import { DayState, LogEntry, emptyDayState, rollIfNewDay, buildLogEntry } from "../lib/prehabSession";

const DAY_KEY = "gym-prehab-v2-today";
const todayStr = () => new Date().toISOString().slice(0, 10);

export function usePrehabSession() {
  const queryClient = useQueryClient();

  // In-progress day state stays in localStorage.
  const [day, setDay] = useState<DayState>(() => {
    try {
      const raw = localStorage.getItem(DAY_KEY);
      if (raw) return rollIfNewDay(JSON.parse(raw) as DayState, todayStr());
    } catch { /* ignore */ }
    return emptyDayState(todayStr());
  });

  useEffect(() => {
    try { localStorage.setItem(DAY_KEY, JSON.stringify(day)); } catch { /* ignore */ }
  }, [day]);

  // Completed-session log comes from the backend.
  const { data: log = [] } = useQuery({
    queryKey: ["prehab-history"],
    queryFn: () => api.getPrehabHistory().then((r) => r.sessions as LogEntry[]),
  });

  const mutation = useMutation({
    // buildLogEntry(day) is structurally a PrehabCompleteRequest; the cast bridges
    // LogEntry's SectionId-keyed record to the API's string-keyed record.
    mutationFn: () => api.completePrehab(buildLogEntry(day) as PrehabCompleteRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prehab-history"] }),
  });

  const setSetsDone = useCallback((exId: string, setsDone: number) => {
    setDay((d) => ({ ...d, entries: { ...d.entries, [exId]: { ...d.entries[exId], setsDone } } }));
  }, []);

  const setWeight = useCallback((exId: string, weight: string) => {
    setDay((d) => ({
      ...d,
      entries: { ...d.entries, [exId]: { ...d.entries[exId], setsDone: d.entries[exId]?.setsDone ?? 0, weight } },
    }));
  }, []);

  const completeSession = useCallback(() => { mutation.mutate(); }, [mutation]);

  return {
    day,
    log,
    setSetsDone,
    setWeight,
    completeSession,
    isSaving: mutation.isPending,
    isSaved: mutation.isSuccess,
    saveError: mutation.isError,
  };
}
```

- [ ] **Step 5: Verify the build type-checks**

Run: `cd ~/gym-tracker/frontend && npm run build`
Expected: build succeeds, no TS errors. (If the `as PrehabCompleteRequest` cast errors, STOP and report — do not switch to `as unknown`.)

- [ ] **Step 6: Commit**
```bash
cd ~/gym-tracker
git add frontend/src/hooks/usePrehabSession.ts frontend/src/lib/prehabSession.ts frontend/src/lib/prehabSession.test.ts
git commit -m "feat(prehab): back the session log with react-query; drop localStorage log + appendLog"
```

---

### Task 6: PrehabTab saving + error states

**Files:**
- Modify: `frontend/src/components/PrehabTab.tsx`

**Interfaces:**
- Consumes: the new `usePrehabSession` return (`isSaving`, `isSaved`, `saveError`); existing `Toast` component (`frontend/src/components/Toast.tsx`, props `{ message: string; type: "success" | "error"; onDismiss: () => void }`).

- [ ] **Step 1: Update the tab to use the new states**

In `frontend/src/components/PrehabTab.tsx`:

(a) Add the `Toast` import alongside the other imports:
```tsx
import Toast from "./Toast";
```

(b) Change the hook destructure to include the new fields and drop the local `justSaved` state. Replace:
```tsx
  const { day, log, setSetsDone, setWeight, completeSession } = usePrehabSession();
  const timer = useSessionTimer(TIMER_KEY);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    shoulders: true,
    lowerback: false,
    proprioception: false,
  });
  const [justSaved, setJustSaved] = useState(false);
```
with:
```tsx
  const { day, log, setSetsDone, setWeight, completeSession, isSaving, isSaved, saveError } = usePrehabSession();
  const timer = useSessionTimer(TIMER_KEY);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    shoulders: true,
    lowerback: false,
    proprioception: false,
  });
  const [errorDismissed, setErrorDismissed] = useState(false);
```

(c) Replace the `handleComplete` function:
```tsx
  const handleComplete = () => {
    completeSession();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };
```
with:
```tsx
  const handleComplete = () => {
    setErrorDismissed(false);
    completeSession();
  };
```

(d) Replace the Complete button block:
```tsx
      <button
        onClick={handleComplete}
        disabled={overall.done === 0}
        className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg touch-target transition-all duration-200 active:scale-[0.98] ${
          justSaved
            ? "bg-green-600 text-white"
            : overall.done === 0
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-700/25 hover:brightness-110"
        }`}
      >
        {justSaved ? "Saved!" : `Complete Session (${overall.done}/${overall.total})`}
      </button>
```
with:
```tsx
      <button
        onClick={handleComplete}
        disabled={overall.done === 0 || isSaving}
        className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg touch-target transition-all duration-200 active:scale-[0.98] ${
          isSaved && !isSaving
            ? "bg-green-600 text-white"
            : overall.done === 0 || isSaving
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-700/25 hover:brightness-110"
        }`}
      >
        {isSaving ? "Saving…" : isSaved ? "Saved!" : `Complete Session (${overall.done}/${overall.total})`}
      </button>
```

(e) Add the error Toast just before the component's closing `</div>` (the outermost one, after the Recent Log block):
```tsx
      {saveError && !errorDismissed && (
        <Toast
          message="Couldn't save — check your connection and try again."
          type="error"
          onDismiss={() => setErrorDismissed(true)}
        />
      )}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd ~/gym-tracker/frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**
```bash
cd ~/gym-tracker
git add frontend/src/components/PrehabTab.tsx
git commit -m "feat(prehab): Saving state + error Toast on the tab"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Backend suite**

Run: `cd ~/gym-tracker/backend && python3 -m pytest -v`
Expected: all tests pass (existing `test_history.py` + the 10 in `test_prehab.py`).

- [ ] **Step 2: Frontend tests + build**

Run: `cd ~/gym-tracker/frontend && npm test && npm run build`
Expected: vitest 11 passing; `tsc && vite build` clean.

- [ ] **Step 3: Manual smoke test (requires the `Prehab` tab + a running stack)**

Prerequisite: add an empty tab named `Prehab` to the spreadsheet (the backend writes its header on first save).

With backend running and `cd frontend && npm run dev`:
- [ ] Open the Prehab tab, tick some exercises, tap **Complete Session** → button shows "Saving…" then "Saved!".
- [ ] A row appears in the `Prehab` sheet tab (`Date | 4/4 | 3/3 | 1/1 | 8/8` style), and the Recent Log shows today's entry.
- [ ] Complete again same day → the same sheet row is overwritten (no duplicate row).
- [ ] Reload the page → Recent Log loads from the backend (not localStorage); in-progress ticks restore from localStorage.
- [ ] Stop the backend (or go offline) and tap Complete → error Toast appears and the session ticks are preserved for retry.

- [ ] **Step 4: Final commit (only if Step 1/2 required fixes)**
```bash
cd ~/gym-tracker && git add -A && git commit -m "chore(prehab): verification fixes"
```
(Skip if nothing needed fixing.)

---

## Notes for the implementer
- Do not modify `TodayWorkout.tsx`/`ExerciseCard.tsx` or the workout endpoints.
- `buildLogEntry(day)` is intentionally reused as the POST payload — its shape (`{date,done,total,sections}`) equals `PrehabCompleteRequest`.
- The `Prehab` tab must be created manually (empty) once; the backend fills the header. If it's missing entirely, `save` will 500 — that's expected and surfaces as the error Toast.
- react-query's `QueryClientProvider` already wraps the app (the workout tab uses `useQuery`), so no provider setup is needed.
