"""Prehab session persistence — completed daily prehab summaries in the Prehab tab.

Mirrors history.py: pure row build/parse helpers plus thin Google Sheets I/O.
A row is: Date | Shoulders | Lower Back | Proprioception | Total, where each
section/total cell is "done/total". Dedup is by date (one row per day).
"""
import json
import sheets_client
from models import PrehabCompleteRequest, PrehabSession, PrehabSectionProgress, PrehabDetail

PREHAB_TAB = "Prehab"
SECTION_ORDER = ["shoulders", "lowerback", "proprioception"]
PREHAB_HEADER = ["Date", "Shoulders", "Lower Back", "Proprioception", "Total", "Notes", "Detail"]


def _safe_get(row: list[str], idx: int) -> str:
    return row[idx].strip() if idx < len(row) else ""


def prehab_row(req: PrehabCompleteRequest) -> list[str]:
    """Serialize a completed session into a sheet row."""
    cells = [req.date]
    for sid in SECTION_ORDER:
        p = req.sections.get(sid) or PrehabSectionProgress(done=0, total=0)
        cells.append(f"{p.done}/{p.total}")
    cells.append(f"{req.done}/{req.total}")
    cells.append(req.notes)
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
        if not isinstance(data, dict):
            return None
        sr = data.get("shoulderrehab")
        shoulderrehab = PrehabSectionProgress(done=int(sr["done"]), total=int(sr["total"])) if sr else None
        weights = {str(k): str(v) for k, v in (data.get("weights") or {}).items()}
        return PrehabDetail(shoulderrehab=shoulderrehab, weights=weights)
    except Exception:
        return None


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
    notes = _safe_get(row, 2 + len(SECTION_ORDER))
    detail = _parse_detail(_safe_get(row, 3 + len(SECTION_ORDER)))
    return PrehabSession(date=date, done=total.done, total=total.total, sections=sections, notes=notes, detail=detail)


def find_row_index(rows: list[list[str]], date: str) -> int | None:
    """Index into the fetched rows (incl. header) whose Date cell == date, else None."""
    for i, row in enumerate(rows):
        if _safe_get(row, 0) == date:
            return i
    return None


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
