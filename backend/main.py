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
async def backfill_history():
    """Backfill the History tab from all existing workout tabs."""
    try:
        by_type = sheets_client.get_tabs_by_type()
        processed = 0
        errors = []
        all_tabs = [
            tab_name
            for tab_names in by_type.values()
            for tab_name in tab_names
        ]
        for tab_name in all_tabs:
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
    return {"status": "ok", "tabs_processed": processed, "errors": errors}


@app.post("/api/cache/invalidate")
async def invalidate_cache():
    sheets_client.invalidate_cache()
    return {"status": "ok"}


@app.get("/health")
async def health():
    return {"status": "ok"}
