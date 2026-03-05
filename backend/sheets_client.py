import os
import json
import re
import time
from googleapiclient.discovery import build
from google.oauth2 import service_account


SPREADSHEET_ID = "1h_HHlAL8dZhHFRunnQvQDbGB73Q7SotiFxWy6bC5rf0"
WORKOUT_TYPES = {"U1": "Upper 1", "U2": "Upper 2", "L1": "Lower 1", "L2": "Lower 2", "Arm": "Arms"}

_cache: dict[str, tuple[float, object]] = {}
CACHE_TTL = 300  # 5 minutes

_service = None


def _get_service():
    """Sheets service using service account (read/write)."""
    global _service
    if _service is None:
        sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        if not sa_json:
            raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON not set")
        # Env var may have line-wrapping artifacts; strip them for valid JSON.
        cleaned = re.sub(r'\n\s*', '', sa_json)
        info = json.loads(cleaned)
        # Fix PEM markers that lost spaces during line-wrap removal
        if 'private_key' in info:
            info['private_key'] = (
                info['private_key']
                .replace('BEGINPRIVATEKEY', 'BEGIN PRIVATE KEY')
                .replace('ENDPRIVATEKEY', 'END PRIVATE KEY')
            )
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
        _service = build("sheets", "v4", credentials=creds)
    return _service


def _classify_tab(tab_name: str) -> str | None:
    """Extract workout type from tab name. Returns U1/U2/L1/L2/Arm or None."""
    name = tab_name.strip()
    if name == "History":
        return None
    # Match patterns like "26Feb23 U1", "25Aug11 U1", " 24 Apr  L2", "25 Apr Arm"
    for wtype in WORKOUT_TYPES:
        if re.search(rf'\b{re.escape(wtype)}\b', name, re.IGNORECASE):
            return wtype
    return None


def get_all_tab_names() -> list[str]:
    """Get all tab names from the spreadsheet."""
    now = time.time()
    cache_key = "__tab_names__"
    if cache_key in _cache:
        cached_time, cached_data = _cache[cache_key]
        if now - cached_time < CACHE_TTL:
            return cached_data

    service = _get_service()
    meta = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    names = [s["properties"]["title"] for s in meta["sheets"]]
    _cache[cache_key] = (now, names)
    return names


def get_tabs_by_type() -> dict[str, list[str]]:
    """Group tab names by workout type. Returns {type: [tab_names]} ordered by tab position (newest last)."""
    all_tabs = get_all_tab_names()
    by_type: dict[str, list[str]] = {wt: [] for wt in WORKOUT_TYPES}
    for tab in all_tabs:
        wtype = _classify_tab(tab)
        if wtype:
            by_type[wtype].append(tab)
    return by_type


def get_latest_tabs() -> dict[str, str]:
    """Get the most recent (last) tab name for each workout type."""
    by_type = get_tabs_by_type()
    return {wtype: tabs[-1] for wtype, tabs in by_type.items() if tabs}


def fetch_tab(tab_name: str) -> list[list[str]]:
    """Fetch all data from a tab, with caching."""
    now = time.time()
    if tab_name in _cache:
        cached_time, cached_data = _cache[tab_name]
        if now - cached_time < CACHE_TTL:
            return cached_data

    service = _get_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=f"'{tab_name}'")
        .execute()
    )
    rows = result.get("values", [])
    _cache[tab_name] = (now, rows)
    return rows


def write_cells(tab_name: str, updates: list[dict]):
    """Write values to specific cells. Each update: {row, col, value}."""
    if not updates:
        return
    service = _get_service()
    data = []
    for u in updates:
        row = u["row"] + 1  # 0-indexed → 1-indexed
        col = u["col"]
        col_letter = ""
        c = col
        while c >= 0:
            col_letter = chr(ord("A") + c % 26) + col_letter
            c = c // 26 - 1
        cell_ref = f"'{tab_name}'!{col_letter}{row}"
        data.append({"range": cell_ref, "values": [[u["value"]]]})

    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={"valueInputOption": "USER_ENTERED", "data": data},
    ).execute()

    _cache.pop(tab_name, None)


def append_rows(tab_name: str, rows: list[list[str]]):
    """Append rows to a tab (used for History)."""
    service = _get_service()
    service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{tab_name}'!A1",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": rows},
    ).execute()
    _cache.pop(tab_name, None)


STRUCTURE_TAB = "Structure"


def update_structure_cells(updates: list[dict]):
    """Write weight/target back to Structure tab after double-progression."""
    write_cells(STRUCTURE_TAB, updates)


def invalidate_cache():
    """Clear all cached data."""
    _cache.clear()
