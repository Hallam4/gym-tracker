import asyncio
import logging
import os
import re
from datetime import datetime
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import sheets_client
import parser
import history
from models import (
    WorkoutSession,
    WorkoutPlan,
    LogWorkoutRequest,
    ProgressResponse,
    PRsResponse,
    TabInfo,
    TabsResponse,
    WorkoutSummaryResponse,
    StreakResponse,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="Gym Tracker API", docs_url=None, redoc_url=None)

GYM_API_KEY = os.environ.get("GYM_API_KEY", "")


def _require_api_key(x_api_key: str = Header(None)):
    """Validate API key on write endpoints."""
    if not GYM_API_KEY:
        return  # No key configured — skip auth (dev mode)
    if x_api_key != GYM_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _safe_error(e: Exception) -> str:
    """Return a sanitized error message, stripping API keys and internal details."""
    msg = str(e)
    # Google API errors contain ?key=... in URLs
    if "key=" in msg or "spreadsheetId" in msg.lower() or "googleapis" in msg:
        logger.error("Google API error (sanitized): %s", msg)
        return "Google Sheets request failed"
    return msg

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gym-tracker-frontend-uhu5.onrender.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_rep_range(target: str | None, reps: str | None) -> tuple[int, int]:
    """Parse target/reps into (rep_min, rep_max), handling ranges and AMRAP."""
    for val in (target, reps):
        if not val or val.upper() == "AMRAP":
            continue
        if "-" in val:
            lo, hi = val.split("-", 1)
            return int(lo), int(hi)
        n = int(val)
        return max(1, n - 2), n
    return 8, 12  # sensible default for AMRAP / missing data


def _enrich_with_progression(session: WorkoutSession):
    """Add double-progression suggestions to each exercise in the session."""
    all_history = history.get_all_history()
    for ex in session.exercises:
        rep_min, rep_max = _parse_rep_range(ex.target, ex.reps)
        result = history.compute_double_progression(ex.name, rep_min, rep_max, all_history)
        if result:
            ex.suggested_weight = result["suggested_weight"]
            ex.suggested_target = result["suggested_target"]
            ex.prev_sets = result["prev_sets"]
            ex.prev_weight = result["prev_weight"]
            ex.sessions_at_ceiling = result["sessions_at_ceiling"]


@app.get("/api/tabs", response_model=TabsResponse)
async def get_tabs():
    """Get all workout tabs grouped by type, with the latest for each."""
    try:
        by_type = sheets_client.get_tabs_by_type()
        latest = sheets_client.get_latest_tabs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))

    all_tabs = {}
    for wtype, tab_names in by_type.items():
        all_tabs[wtype] = [
            TabInfo(
                tab_name=name,
                workout_type=wtype,
                type_label=sheets_client.WORKOUT_TYPES[wtype],
            )
            for name in tab_names
        ]

    latest_infos = {}
    for wtype, tab_name in latest.items():
        latest_infos[wtype] = TabInfo(
            tab_name=tab_name,
            workout_type=wtype,
            type_label=sheets_client.WORKOUT_TYPES[wtype],
        )

    return TabsResponse(latest=latest_infos, all_tabs=all_tabs)


@app.get("/api/workouts", response_model=WorkoutPlan)
async def get_workouts():
    """Get the most recent workout for each type."""
    try:
        latest = sheets_client.get_latest_tabs()
        sessions = []
        for wtype, tab_name in latest.items():
            rows = sheets_client.fetch_tab(tab_name)
            session = parser.parse_tab(tab_name, rows)
            sessions.append(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return WorkoutPlan(sessions=sessions)


@app.get("/api/workouts/by-type/{workout_type}", response_model=WorkoutSession)
async def get_workout_by_type(workout_type: str):
    """Get the most recent workout for a given type (u1, u2, l1, l2, arm)."""
    wtype = workout_type.upper()
    if wtype not in sheets_client.WORKOUT_TYPES:
        # Try case-insensitive match
        for k in sheets_client.WORKOUT_TYPES:
            if k.lower() == workout_type.lower():
                wtype = k
                break
        else:
            raise HTTPException(status_code=404, detail=f"Unknown workout type: {workout_type}")

    try:
        latest = sheets_client.get_latest_tabs()
        tab_name = latest.get(wtype)
        if not tab_name:
            raise HTTPException(status_code=404, detail=f"No tabs found for type: {wtype}")
        rows = sheets_client.fetch_tab(tab_name)
        session = parser.parse_tab(tab_name, rows)
        _enrich_with_progression(session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return session


@app.get("/api/workouts/tab/{tab_name:path}", response_model=WorkoutSession)
async def get_workout_by_tab(tab_name: str):
    """Get a specific workout tab by its exact name."""
    try:
        rows = sheets_client.fetch_tab(tab_name)
        session = parser.parse_tab(tab_name, rows)
        _enrich_with_progression(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return session


@app.post("/api/workouts/tab/{tab_name:path}/log", dependencies=[Depends(_require_api_key)])
async def log_workout(tab_name: str, req: LogWorkoutRequest):
    """Write cell updates to a specific tab."""
    try:
        sheets_client.write_cells(tab_name, [u.model_dump() for u in req.updates])
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return {"status": "ok"}


@app.post("/api/workouts/tab/{tab_name:path}/complete", response_model=WorkoutSummaryResponse, dependencies=[Depends(_require_api_key)])
async def complete_workout(tab_name: str):
    """Mark a workout as complete — saves to History tab and returns summary."""
    try:
        rows = sheets_client.fetch_tab(tab_name)
        session = parser.parse_tab(tab_name, rows)
        # Compute summary BEFORE appending so current session isn't in "prior" data
        from datetime import date
        summaries = history.compute_workout_summary(session.exercises, date.today().isoformat())
        history.append_workout(session.day, session.exercises)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    new_prs = sum(1 for s in summaries if s.is_weight_pr or s.is_1rm_pr)
    return WorkoutSummaryResponse(
        status="ok",
        exercises_logged=len(summaries),
        exercise_summaries=summaries,
        new_prs_count=new_prs,
    )


@app.get("/api/streaks", response_model=StreakResponse)
async def get_streaks():
    """Get workout streak and consistency data."""
    try:
        data = history.get_streak_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return StreakResponse(streaks=data)


@app.get("/api/prs", response_model=PRsResponse)
async def get_prs():
    try:
        prs = history.get_prs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return PRsResponse(prs=prs)


@app.get("/api/progress/{exercise}", response_model=ProgressResponse)
async def get_progress(exercise: str):
    try:
        data = history.get_exercise_progress(exercise)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return ProgressResponse(exercise=exercise, history=data)


@app.post("/api/history/backfill", dependencies=[Depends(_require_api_key)])
async def backfill_history(offset: int = 0, limit: int = 10):
    """Backfill the History tab from existing workout tabs.

    Processes `limit` tabs starting at `offset` to stay within request timeouts.
    Call repeatedly with increasing offset until remaining == 0.
    """
    try:
        by_type = sheets_client.get_tabs_by_type()
        all_tabs = [
            tab_name
            for tab_names in by_type.values()
            for tab_name in tab_names
        ]
        batch = all_tabs[offset:offset + limit]
        processed = 0
        errors = []
        for tab_name in batch:
            try:
                rows = sheets_client.fetch_tab(tab_name)
                session = parser.parse_tab(tab_name, rows)
                # Convert human date like "2 February 2026" to ISO "2026-02-02"
                iso_date = None
                if session.date:
                    try:
                        iso_date = datetime.strptime(session.date, "%d %B %Y").strftime("%Y-%m-%d")
                    except ValueError:
                        errors.append(f"{tab_name}: could not parse date '{session.date}'")
                        continue
                else:
                    errors.append(f"{tab_name}: no date found")
                    continue
                history.append_workout(session.day, session.exercises, workout_date=iso_date)
                processed += 1
            except Exception as e:
                errors.append(f"{tab_name}: {_safe_error(e)}")
            # Rate limit: ~2 API calls per tab (read + write), stay under 60/min
            await asyncio.sleep(2.5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    remaining = max(0, len(all_tabs) - offset - limit)
    return {
        "status": "ok",
        "tabs_processed": processed,
        "total_tabs": len(all_tabs),
        "offset": offset,
        "remaining": remaining,
        "errors": errors,
    }


@app.post("/api/cache/invalidate", dependencies=[Depends(_require_api_key)])
async def invalidate_cache():
    sheets_client.invalidate_cache()
    return {"status": "ok"}



_TAB_DATE_RE = re.compile(r"(\d{2})([A-Za-z]{3,4})(\d{1,2})\s")
_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "spet": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_date_from_tab_name(tab_name: str) -> str | None:
    """Parse date from tab name format DDMonYY (e.g. '17Feb26 U1' → '17 February 2026')."""
    m = _TAB_DATE_RE.search(tab_name)
    if not m:
        return None
    day = int(m.group(1))
    month_num = _MONTH_MAP.get(m.group(2).lower())
    year = 2000 + int(m.group(3))
    if not month_num:
        return None
    try:
        dt = datetime(year, month_num, day)
        return dt.strftime("%-d %B %Y")
    except ValueError:
        return None


@app.post("/api/fix-dates", dependencies=[Depends(_require_api_key)])
async def fix_dates(dry_run: bool = True):
    """Fix dates in row 1 of each tab based on the tab name (authoritative source).

    Pass ?dry_run=false to actually write corrections.
    """
    try:
        by_type = sheets_client.get_tabs_by_type()
        all_tabs = [tab for tabs in by_type.values() for tab in tabs]

        fixes = []
        errors = []
        for tab_name in all_tabs:
            parsed_date = _parse_date_from_tab_name(tab_name)
            if not parsed_date:
                errors.append(f"{tab_name}: could not parse date from tab name")
                continue
            try:
                rows = sheets_client.fetch_tab(tab_name)
                current_date = rows[1][1].strip() if len(rows) > 1 and len(rows[1]) > 1 else ""
                if current_date != parsed_date:
                    fixes.append({
                        "tab": tab_name,
                        "current": current_date,
                        "corrected": parsed_date,
                    })
                    if not dry_run:
                        sheets_client.write_cells(tab_name, [{"row": 1, "col": 1, "value": parsed_date}])
                        await asyncio.sleep(2)  # rate limit
            except Exception as e:
                errors.append(f"{tab_name}: {_safe_error(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))

    return {
        "status": "dry_run" if dry_run else "applied",
        "fixes": fixes,
        "total_fixes": len(fixes),
        "errors": errors,
    }


@app.get("/")
async def root():
    return {"app": "Gym Tracker API", "health": "/health", "docs": "/api/tabs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
