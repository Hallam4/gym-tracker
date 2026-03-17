import logging
import os
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import sheets_client
import parser
import history
from models import (
    Exercise,
    WorkoutSession,
    ProgressResponse,
    PRsResponse,
    WorkoutSummaryResponse,
    StreakResponse,
    CompleteWorkoutRequest,
    HistorySession,
    HistorySessionsResponse,
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
    """Parse reps into (rep_min, rep_max). Target is a session hint, not the range."""
    for val in (reps, target):
        if not val or val.upper() == "AMRAP":
            continue
        try:
            if "-" in val:
                lo, hi = val.split("-", 1)
                return int(lo), int(hi)
            n = int(val)
            return max(2, n - 2), n
        except ValueError:
            continue
    return 8, 12  # sensible default for AMRAP / non-numeric / missing data


def _enrich_with_progression(session: WorkoutSession):
    """Add double-progression suggestions to each exercise in the session."""
    all_history = history.get_all_history()
    for ex in session.exercises:
        rep_min, rep_max = _parse_rep_range(ex.target, ex.reps)
        ex.rep_min = rep_min
        ex.rep_max = rep_max
        ex.is_amrap = bool(ex.reps and ex.reps.upper() == "AMRAP") or bool(ex.target and ex.target.upper() == "AMRAP")
        current_target = int(ex.target) if ex.target and ex.target.isdigit() else rep_max
        result = history.compute_double_progression(ex.name, rep_min, rep_max, all_history, current_target)
        if result:
            ex.suggested_weight = result["suggested_weight"]
            ex.suggested_target = result["suggested_target"]
            ex.prev_sets = result["prev_sets"]
            ex.prev_weight = result["prev_weight"]
            ex.sessions_at_ceiling = result["sessions_at_ceiling"]


@app.get("/api/structure/{workout_type}", response_model=WorkoutSession)
async def get_structure(workout_type: str):
    """Get workout structure for a given type from the Structure tab."""
    wtype = workout_type.upper()
    if wtype not in sheets_client.WORKOUT_TYPES:
        for k in sheets_client.WORKOUT_TYPES:
            if k.lower() == workout_type.lower():
                wtype = k
                break
        else:
            raise HTTPException(status_code=404, detail=f"Unknown workout type: {workout_type}")

    try:
        rows = sheets_client.fetch_tab(sheets_client.STRUCTURE_TAB)
        by_type = parser.parse_structure_tab(rows)
        exercises = by_type.get(wtype, [])
        if not exercises:
            raise HTTPException(status_code=404, detail=f"No exercises found for type: {wtype}")
        from datetime import date as date_cls
        session = WorkoutSession(
            day=wtype,
            date=date_cls.today().strftime("%-d %B %Y"),
            tab_name="Structure",
            exercises=exercises,
        )
        _enrich_with_progression(session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return session


@app.post("/api/workouts/complete", response_model=WorkoutSummaryResponse, dependencies=[Depends(_require_api_key)])
async def complete_workout_new(req: CompleteWorkoutRequest):
    """Complete a workout — saves to History and optionally updates Structure weights."""
    try:
        from datetime import date as date_cls
        today = date_cls.today().isoformat()

        # Build Exercise objects for summary computation
        summary_exercises = []
        for ex in req.exercises:
            summary_exercises.append(Exercise(
                name=ex.name,
                reps=ex.reps,
                sets=ex.sets,
                weight=ex.weight,
                target=ex.target,
                set_results=ex.set_results,
                rest_times=ex.rest_times,
                notes=ex.notes,
                notes_col=None,
                sheet_row=0,
                superset_group=0,
            ))

        summaries = history.compute_workout_summary(summary_exercises, today)
        history.append_completed_workout(req.day, req.exercises, req.is_deload)

        # Update Structure weight/target if double-progression fires
        all_history = history.get_all_history()
        rows = sheets_client.fetch_tab(sheets_client.STRUCTURE_TAB)
        by_type = parser.parse_structure_tab(rows)
        structure_exercises = by_type.get(req.day, [])

        updates = []
        header = rows[0]
        weight_col = None
        target_col = None
        for j, cell in enumerate(header):
            key = cell.strip().lower()
            if key == "weight":
                weight_col = j
            elif key == "target":
                target_col = j

        for struct_ex in structure_exercises:
            rep_min, rep_max = _parse_rep_range(struct_ex.target, struct_ex.reps)
            current_target = int(struct_ex.target) if struct_ex.target and struct_ex.target.isdigit() else rep_max
            result = history.compute_double_progression(struct_ex.name, rep_min, rep_max, all_history, current_target)
            if not result:
                continue
            if result["sessions_at_ceiling"] >= 1 and result["suggested_weight"] and weight_col is not None:
                updates.append({"row": struct_ex.sheet_row, "col": weight_col, "value": f"{result['suggested_weight']}kg"})
            if target_col is not None and result["suggested_target"]:
                updates.append({"row": struct_ex.sheet_row, "col": target_col, "value": result["suggested_target"]})

        if updates:
            sheets_client.update_structure_cells(updates)

    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))

    new_prs = sum(1 for s in summaries if s.is_weight_pr or s.is_1rm_pr)
    return WorkoutSummaryResponse(
        status="ok",
        exercises_logged=len(summaries),
        exercise_summaries=summaries,
        new_prs_count=new_prs,
    )


@app.get("/api/history/sessions", response_model=HistorySessionsResponse)
async def get_history_sessions(type: str | None = None, limit: int = 50, offset: int = 0):
    """Get history sessions, optionally filtered by type."""
    try:
        sessions = history.get_history_sessions(type_filter=type, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    return HistorySessionsResponse(sessions=sessions)


@app.get("/api/history/session/{date}/{day}", response_model=HistorySession)
async def get_history_session(date: str, day: str):
    """Get a single history session by date and day."""
    try:
        session = history.get_history_session(date, day)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_safe_error(e))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


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


@app.post("/api/cache/invalidate", dependencies=[Depends(_require_api_key)])
async def invalidate_cache():
    sheets_client.invalidate_cache()
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"app": "Gym Tracker API", "health": "/health"}


@app.get("/health")
async def health():
    return {"status": "ok"}
