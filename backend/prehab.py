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
