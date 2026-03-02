import asyncio
from datetime import datetime
from fastapi import FastAPI, HTTPException
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
)

app = FastAPI(title="Gym Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/tabs", response_model=TabsResponse)
async def get_tabs():
    """Get all workout tabs grouped by type, with the latest for each."""
    try:
        by_type = sheets_client.get_tabs_by_type()
        latest = sheets_client.get_latest_tabs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=500, detail=str(e))
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return session


@app.get("/api/workouts/tab/{tab_name:path}", response_model=WorkoutSession)
async def get_workout_by_tab(tab_name: str):
    """Get a specific workout tab by its exact name."""
    try:
        rows = sheets_client.fetch_tab(tab_name)
        session = parser.parse_tab(tab_name, rows)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return session


@app.post("/api/workouts/tab/{tab_name:path}/log")
async def log_workout(tab_name: str, req: LogWorkoutRequest):
    """Write cell updates to a specific tab."""
    try:
        sheets_client.write_cells(tab_name, req.updates)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok"}


@app.post("/api/workouts/tab/{tab_name:path}/complete")
async def complete_workout(tab_name: str):
    """Mark a workout as complete — saves to History tab."""
    try:
        rows = sheets_client.fetch_tab(tab_name)
        session = parser.parse_tab(tab_name, rows)
        history.append_workout(session.day, session.exercises)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok", "exercises_logged": len(session.exercises)}


@app.get("/api/prs", response_model=PRsResponse)
async def get_prs():
    try:
        prs = history.get_prs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return PRsResponse(prs=prs)


@app.get("/api/progress/{exercise}", response_model=ProgressResponse)
async def get_progress(exercise: str):
    try:
        data = history.get_exercise_progress(exercise)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ProgressResponse(exercise=exercise, history=data)


@app.post("/api/history/backfill")
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
                errors.append(f"{tab_name}: {e}")
            # Rate limit: ~2 API calls per tab (read + write), stay under 60/min
            await asyncio.sleep(2.5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    remaining = max(0, len(all_tabs) - offset - limit)
    return {
        "status": "ok",
        "tabs_processed": processed,
        "total_tabs": len(all_tabs),
        "offset": offset,
        "remaining": remaining,
        "errors": errors,
    }


@app.post("/api/cache/invalidate")
async def invalidate_cache():
    sheets_client.invalidate_cache()
    return {"status": "ok"}


@app.get("/api/debug/sa-parse")
async def debug_sa_parse():
    """Temporary diagnostic for service account JSON parsing issues."""
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    # Show char codes around the problematic position (char 81)
    context = sa_json[75:95] if len(sa_json) > 95 else sa_json[75:]
    char_codes = [ord(c) for c in context]

    import json as json_mod
    results = {}
    strategies = [
        ("plain", lambda s: json_mod.loads(s)),
        ("strict_false", lambda s: json_mod.loads(s, strict=False)),
        ("regex+strict", lambda s: json_mod.loads(
            sheets_client._INVALID_ESCAPE_RE.sub(r'\\\\', s), strict=False
        )),
    ]
    for name, fn in strategies:
        try:
            info = fn(sa_json)
            pk = info.get("private_key", "")
            results[name] = {
                "ok": True,
                "keys": sorted(info.keys()),
                "pk_len": len(pk),
                "pk_starts_begin": pk[:30],
                "pk_ends_end": pk[-35:],
                "pk_has_real_newlines": "\n" in pk,
            }
        except Exception as e:
            results[name] = {"ok": False, "error": str(e)[:200]}

    return {
        "sa_len": len(sa_json),
        "chars_75_95_repr": repr(context),
        "chars_75_95_codes": char_codes,
        "strategies": results,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
