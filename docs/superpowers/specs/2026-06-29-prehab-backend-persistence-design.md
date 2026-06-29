# Prehab Backend Persistence — Design Spec

**Date:** 2026-06-29
**Status:** Approved (design), pending spec review → implementation plan
**Branch:** `prehab-daily-redesign` (extends the daily-prehab redesign)
**Builds on:** `2026-06-29-prehab-daily-redesign-design.md`

## 1. Goal

Persist **completed** prehab sessions to the backend (a dedicated Google Sheet tab) instead of localStorage, so the prehab history is durable and available across devices — the same way completed workouts are saved.

## 2. Scope (what changes vs. the localStorage version)

- **Completed-session summaries move to the backend** (date + per-section done/total + overall).
- **In-progress day state stays in localStorage** — unchanged. (The workout tab works the same way: mid-workout is local, only completion hits the backend.)
- The localStorage **log** key (`gym-prehab-v2-log`) is **removed**; the backend becomes the source of truth for history.

**Out of scope:** per-exercise weights/sets persistence, live in-progress cross-device sync, prehab appearing in the existing History/streaks/volume views. (Possible later increments.)

## 3. Locked decisions

- Store: a **dedicated `Prehab` Google Sheet tab** (not the History tab).
- **Dedupe by date**: completing twice in one day overwrites that day's row (matches the current local-log behavior).
- Persist only on **Complete Session** (append/overwrite a row); no write-on-every-tap.
- Reuse existing infra: `X-API-Key` auth, `@tanstack/react-query` (already in the app), `Toast`, `sheets_client` append/fetch/write.

## 4. Data store — `Prehab` tab

One row per completed session. Header (created **manually once** in the spreadsheet, like Structure/History — the append API cannot create a tab):

| Date | Shoulders | Lower Back | Proprioception | Total |
|------|-----------|------------|----------------|-------|
| 2026-06-29 | 4/4 | 3/3 | 1/1 | 8/8 |

- `Date` = ISO `YYYY-MM-DD`. Section/Total cells = `"done/total"`.
- Section columns are fixed and ordered: `shoulders`, `lowerback`, `proprioception` (the current section set). If the section set changes, this schema changes with it (documented coupling).

## 5. Backend

### 5.1 `backend/prehab.py` (new module, mirrors `history.py`)
Split into pure (unit-testable) helpers + thin I/O:
```python
PREHAB_TAB = "Prehab"
SECTION_ORDER = ["shoulders", "lowerback", "proprioception"]

# pure
def prehab_row(req: PrehabCompleteRequest) -> list[str]:
    # [date, "d/t" per section in SECTION_ORDER, "d/t" total]
def parse_prehab_row(row: list[str]) -> PrehabSession | None:
    # None for the header row or malformed rows (date cell not an ISO date)
def find_row_index(rows: list[list[str]], date: str) -> int | None:
    # index into the fetched rows (incl. header) whose Date cell == date, else None

# thin I/O (wrap sheets_client)
def get_prehab_sessions(limit: int = 30) -> list[PrehabSession]:
    # fetch_tab(PREHAB_TAB) → parse data rows → drop None → reverse (newest first) → [:limit]
def save_prehab_session(req: PrehabCompleteRequest) -> None:
    # rows = fetch_tab(PREHAB_TAB); i = find_row_index(rows, req.date)
    # if i is not None: write_cells(PREHAB_TAB, [{row:i, col:c, value:v} for c,v in enumerate(prehab_row(req))])
    # else: append_rows(PREHAB_TAB, [prehab_row(req)])
```
`write_cells` is 0-indexed on `row` (it adds +1 internally) and the fetched `rows` are 0-indexed including the header, so `find_row_index` returning the fetched-list index is the correct `row` value for `write_cells`.

### 5.2 `backend/models.py` (additions)
```python
class PrehabSectionProgress(BaseModel):
    done: int
    total: int

class PrehabCompleteRequest(BaseModel):
    date: str
    done: int
    total: int
    sections: dict[str, PrehabSectionProgress]  # keys: shoulders, lowerback, proprioception

class PrehabSession(BaseModel):
    date: str
    done: int
    total: int
    sections: dict[str, PrehabSectionProgress]

class PrehabHistoryResponse(BaseModel):
    sessions: list[PrehabSession]
```

### 5.3 `backend/main.py` (two endpoints, mirror workout-complete / history)
```python
@app.post("/api/prehab/complete", response_model=dict, dependencies=[Depends(_require_api_key)])
async def complete_prehab(req: PrehabCompleteRequest):
    try:
        prehab.save_prehab_session(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return {"status": "ok"}

@app.get("/api/prehab/history", response_model=PrehabHistoryResponse)
async def get_prehab_history(limit: int = 30):
    try:
        sessions = prehab.get_prehab_sessions(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return PrehabHistoryResponse(sessions=sessions)
```

## 6. Frontend

### 6.1 `src/api/gym.ts` (additions)
```ts
export interface PrehabSectionProgress { done: number; total: number; }
export interface PrehabSession { date: string; done: number; total: number; sections: Record<string, PrehabSectionProgress>; }
export interface PrehabHistoryResponse { sessions: PrehabSession[]; }
export interface PrehabCompleteRequest { date: string; done: number; total: number; sections: Record<string, PrehabSectionProgress>; }
// in `api`:
getPrehabHistory: (limit = 30) => fetchJSON<PrehabHistoryResponse>(`/api/prehab/history?limit=${limit}`),
completePrehab: (data: PrehabCompleteRequest) => postJSON<{ status: string }>("/api/prehab/complete", data),
```

### 6.2 `src/hooks/usePrehabSession.ts` (rewire)
- Keep `day` (in-progress) in localStorage exactly as now (lazy init + persist effect, `rollIfNewDay`).
- Replace the localStorage `log` with react-query:
  - `const { data: log = [] } = useQuery({ queryKey: ["prehab-history"], queryFn: () => api.getPrehabHistory().then(r => r.sessions) })`.
- `completeSession` becomes a mutation:
  - `const mutation = useMutation({ mutationFn: () => api.completePrehab(buildLogEntry(day)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prehab-history"] }) })`.
  - `completeSession = () => mutation.mutate()`.
- Remove the `gym-prehab-v2-log` key and the `appendLog` import. `buildLogEntry(day)` is reused to build the request payload (its return shape already equals `PrehabCompleteRequest`).
- Return shape becomes `{ day, log, setSetsDone, setWeight, completeSession, isSaving: mutation.isPending, saveError: mutation.isError }`.

### 6.3 `src/lib/prehabSession.ts`
- Keep `buildLogEntry` (now the payload builder). **Remove `appendLog`** and its test (now dead — the backend owns dedupe + ordering). `LogEntry` type stays (matches `PrehabSession`).

### 6.4 `src/components/PrehabTab.tsx`
- Consume the new hook fields: Complete button shows **"Saving…"** and is disabled while `isSaving`; on `saveError`, render a `Toast` ("Couldn't save — check connection and retry") and keep the day-state so the user can retry. Keep the "Saved!" transient on success.
- Recent Log renders from `log` (now the query data); while the query is loading there are simply no rows yet (acceptable).

## 7. Data flow
1. User taps sets → `day` updates in localStorage (unchanged).
2. Tap **Complete Session** → `mutation.mutate()` → `POST /api/prehab/complete` with `buildLogEntry(day)`.
3. Backend `save_prehab_session` overwrites today's row or appends → `Prehab` tab.
4. `onSuccess` invalidates `["prehab-history"]` → `GET /api/prehab/history` refetches → Recent Log updates.
5. On failure → Toast shown; day-state is preserved so the user can retry.

## 8. Error handling
- POST failure: surfaced via `saveError` → Toast; day-state preserved; button returns to enabled for retry. (Mirrors the workout tab's "Failed to save workout" behavior.)
- GET failure / empty tab: `log` defaults to `[]` → Recent Log just shows nothing.

## 9. Testing
- **Backend (pytest, alongside `test_history.py`):** `prehab_row`/`parse_prehab_row` round-trip; `parse_prehab_row` returns `None` for the header and malformed rows; `find_row_index` hit/miss; `get_prehab_sessions` ordering (newest-first) + limit and `save_prehab_session` append-vs-overwrite — the I/O functions tested with `monkeypatch` on `sheets_client.fetch_tab`/`append_rows`/`write_cells`.
- **Frontend:** `tsc && vite build` clean; existing vitest suite still green (note: the `appendLog` test is removed with the function). Manual: complete a session → row appears in the sheet and in Recent Log; reload → log loads from backend; airplane-mode complete → Toast + retry.

## 10. Setup / migration
- **Manual one-time:** add a `Prehab` tab to the spreadsheet with the header row from §4.
- No data migration: the old `gym-prehab-v2-log` localStorage key is simply abandoned (and its writer removed); any locally-logged sessions are not back-filled.
