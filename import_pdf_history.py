#!/usr/bin/env python3
"""Import old gym history from PDF exports into Google Sheets.

Usage:
    python import_pdf_history.py          # dry-run (default)
    python import_pdf_history.py --commit # actually append to sheet
"""

import json
import os
import re
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = "1h_HHlAL8dZhHFRunnQvQDbGB73Q7SotiFxWy6bC5rf0"
HISTORY_TAB = "History"
WORKOUT_TYPES = {"U1": "Upper 1", "U2": "Upper 2", "L1": "Lower 1", "L2": "Lower 2", "Arm": "Arms"}

# --- Hardcoded session data parsed from PDF visual inspection ---

SESSIONS = [
    {
        "date": "2024-06-26",
        "day": "U1",
        "source": "Gym Tracker 24 Aug - 26 Aug U1.pdf",
        "exercises": [
            {"name": "OHP",       "weight": "70",   "sets": [3, 3, 2, 3],       "rests": [125, 510, 842],          "notes": "Just getting back into it, I did 60 kg 5s"},
            {"name": "Bench",     "weight": "77.5", "sets": [9, 9, 10, 9],      "rests": [1825, 2180],             "notes": "Just getting back into it, I did 70 kg 12s"},
            {"name": "Leg Raise", "weight": "",     "sets": [12, 12, 10, 10],   "rests": [],                       "notes": ""},
            {"name": "Curl",      "weight": "42.5", "sets": [9, 9, 9, 9],       "rests": [913, 1590],              "notes": ""},
            {"name": "Skull",     "weight": "30",   "sets": [11, 11, 11, 11],   "rests": [],                       "notes": ""},
            {"name": "Pullover",  "weight": "30",   "sets": [9, 9, 9, 9],       "rests": [],                       "notes": ""},
            {"name": "Face",      "weight": "27.5", "sets": [21, 21, 21, 21],   "rests": [],                       "notes": ""},
            {"name": "Chin",      "weight": "",     "sets": [12, 13, 13, 0],    "rests": [3621],                   "notes": ""},
            {"name": "Lu",        "weight": "10",   "sets": [11, 11, 10, 0],    "rests": [],                       "notes": ""},
            {"name": "Shrug",     "weight": "100",  "sets": [12, 12, 12, 12],   "rests": [],                       "notes": ""},
            {"name": "Calf",      "weight": "",     "sets": [46, 46, 46, 0],    "rests": [],                       "notes": ""},
        ],
    },
    {
        "date": "2024-10-02",
        "day": "L1",
        "source": "Gym Tracker 24 Oct - 2 Oct L1.pdf",
        "exercises": [
            {"name": "Squat",           "weight": "100", "sets": [4, 4, 4],    "rests": [902, 1545, 2210],    "notes": ""},
            {"name": "Pause Squat",     "weight": "60",  "sets": [4, 4, 5],    "rests": [2959, 3506],         "notes": "Trying front squat"},
            {"name": "SL Deadlift",     "weight": "100", "sets": [6, 6],       "rests": [5547, 6651, 7723],   "notes": ""},
            {"name": "Pullup",          "weight": "",    "sets": [11, 10],     "rests": [],                   "notes": ""},
            {"name": "Lying Leg Raise", "weight": "",    "sets": [15, 10],     "rests": [],                   "notes": ""},
        ],
    },
    {
        "date": "2024-11-04",
        "day": "U1",
        "source": "Gym Tracker 24 Nov - 4 Nov U1.pdf",
        "exercises": [
            {"name": "OHP",       "weight": "65",   "sets": [5, 5, 5, 5],       "rests": [441, 1025, 2109, 2839],  "notes": ""},
            {"name": "Bench",     "weight": "77.5", "sets": [10, 11, 12, 11],   "rests": [3933, 4616, 5514, 6155], "notes": ""},
            {"name": "Leg Raise", "weight": "",     "sets": [10, 11, 12, 10],   "rests": [],                       "notes": ""},
            {"name": "Curl",      "weight": "35",   "sets": [9, 9, 9],          "rests": [606, 1612, 2917],        "notes": ""},
            {"name": "Skull",     "weight": "27.5", "sets": [8, 8, 12],         "rests": [],                       "notes": ""},
            {"name": "Pullover",  "weight": "27.5", "sets": [6, 6, 10],         "rests": [],                       "notes": ""},
            {"name": "Face",      "weight": "30",   "sets": [18, 18, 17],       "rests": [],                       "notes": ""},
            {"name": "Chin",      "weight": "",     "sets": [12, 12, 12, 0],    "rests": [5453, 7906, 9248, 8310], "notes": ""},
            {"name": "Lu",        "weight": "10",   "sets": [12, 12, 12, 0],    "rests": [],                       "notes": ""},
            {"name": "Shrug",     "weight": "110",  "sets": [14, 14, 14, 12],   "rests": [],                       "notes": ""},
            {"name": "Calf",      "weight": "",     "sets": [46, 46, 46, 0],    "rests": [],                       "notes": ""},
        ],
    },
    {
        "date": "2024-11-11",
        "day": "U1",
        "source": "Gym Tracker 2025 Jan - 03 Dec U1.pdf",
        "exercises": [
            {"name": "OHP",       "weight": "70",   "sets": [3, 3, 3, 4],       "rests": [333, 907, 1436, 2147],   "notes": ""},
            {"name": "Bench",     "weight": "80",   "sets": [9, 12, 12, 8],     "rests": [2757, 3424, 4552, 5401], "notes": ""},
            {"name": "Leg Raise", "weight": "",     "sets": [8, 12, 9, 8],      "rests": [],                       "notes": ""},
            {"name": "Curl",      "weight": "37.5", "sets": [6, 6, 10],         "rests": [835, 1649, 7423],        "notes": ""},
            {"name": "Skull",     "weight": "27.5", "sets": [10, 10, 9],        "rests": [],                       "notes": ""},
            {"name": "Pullover",  "weight": "27.5", "sets": [8, 8, 7],          "rests": [],                       "notes": ""},
            {"name": "Face",      "weight": "30",   "sets": [20, 20, 19],       "rests": [],                       "notes": ""},
            {"name": "Chin",      "weight": "",     "sets": [8, 8, 8, 8],       "rests": [605, 1453, 2740, 4258],  "notes": ""},
            {"name": "Lu",        "weight": "10",   "sets": [8, 8, 8, 8],       "rests": [],                       "notes": ""},
            {"name": "Shrug",     "weight": "115",  "sets": [8, 8, 8, 8],       "rests": [],                       "notes": ""},
            {"name": "Calf",      "weight": "",     "sets": [16, 16, 16, 16],   "rests": [],                       "notes": ""},
        ],
    },
    {
        "date": "2024-11-14",
        "day": "L2",
        "source": "Gym Tracker 2025 May - 24 Apr L2.pdf",
        "exercises": [
            {"name": "Deadlift",         "weight": "115", "sets": [4, 4, 4],       "rests": [1602, 2219, 2927],       "notes": ""},
            {"name": "Back off Deadlift", "weight": "80",  "sets": [4, 4, 3],       "rests": [3154, 3721, 4333],       "notes": ""},
            {"name": "Shrug",            "weight": "115", "sets": [10, 10, 10, 0], "rests": [5015, 6157, 7229, 6356], "notes": ""},
            {"name": "Pull Ups",         "weight": "",    "sets": [6, 6, 6, 0],    "rests": [],                       "notes": ""},
            {"name": "Leg Raise",        "weight": "",    "sets": [6, 6, 6, 0],    "rests": [],                       "notes": ""},
        ],
    },
]


def get_sheets_service():
    """Build Sheets API service using service account JSON."""
    sa_path = os.path.join(os.path.dirname(__file__), "backend", "service-account.json")
    if os.path.exists(sa_path):
        creds = service_account.Credentials.from_service_account_file(
            sa_path, scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
    else:
        sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        if not sa_json:
            raise RuntimeError(
                f"No service account found at {sa_path} and GOOGLE_SERVICE_ACCOUNT_JSON not set"
            )
        cleaned = re.sub(r"\n\s*", "", sa_json)
        info = json.loads(cleaned)
        if "private_key" in info:
            info["private_key"] = (
                info["private_key"]
                .replace("BEGINPRIVATEKEY", "BEGIN PRIVATE KEY")
                .replace("ENDPRIVATEKEY", "END PRIVATE KEY")
            )
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
    return build("sheets", "v4", credentials=creds)


def fetch_existing_keys(service) -> set[tuple[str, str]]:
    """Fetch existing (date, exercise) pairs from History tab."""
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=f"'{HISTORY_TAB}'")
        .execute()
    )
    rows = result.get("values", [])
    keys = set()
    for row in rows[1:]:  # skip header
        if len(row) >= 3 and row[0].strip():
            keys.add((row[0].strip(), row[2].strip()))
    return keys


def build_history_row(date: str, day_label: str, ex: dict) -> list[str]:
    """Convert exercise data to a History tab row."""
    sets = ex["sets"]
    rests = ex["rests"]
    num_sets = len(sets)

    # Pad sets to 5 and rests to 4
    set_vals = [str(s) for s in sets] + [""] * (5 - len(sets))
    rest_vals = [str(r) for r in rests] + [""] * (4 - len(rests))

    return [
        date,
        day_label,
        ex["name"],
        ex["weight"],
        str(num_sets),
        *set_vals[:5],
        *rest_vals[:4],
        ex.get("notes", ""),
    ]


def main():
    commit = "--commit" in sys.argv

    service = get_sheets_service()
    existing_keys = fetch_existing_keys(service)
    print(f"Found {len(existing_keys)} existing (date, exercise) pairs in History tab\n")

    all_new_rows = []
    for session in SESSIONS:
        date = session["date"]
        day_code = session["day"]
        day_label = WORKOUT_TYPES.get(day_code, day_code)
        source = session["source"]

        session_rows = []
        skipped = []
        for ex in session["exercises"]:
            key = (date, ex["name"])
            if key in existing_keys:
                skipped.append(ex["name"])
                continue
            row = build_history_row(date, day_label, ex)
            session_rows.append(row)

        # Print session summary
        status = "SKIP (all exist)" if not session_rows and skipped else ""
        print(f"--- {date} {day_code} ({day_label}) ---")
        print(f"    Source: {source}")
        if skipped:
            print(f"    Skipped (already exist): {', '.join(skipped)}")
        if session_rows:
            for r in session_rows:
                ex_name = r[2]
                weight = r[3] or "BW"
                sets_str = "/".join(s for s in r[5:10] if s)
                rests_str = "/".join(s for s in r[10:14] if s)
                print(f"    + {ex_name:20s}  w={weight:>5s}  sets=[{sets_str}]  rests=[{rests_str}]  {r[14]}")
            all_new_rows.extend(session_rows)
        elif skipped:
            print(f"    -> All {len(skipped)} exercises already in history")
        print()

    print(f"Total new rows to import: {len(all_new_rows)}")

    if not all_new_rows:
        print("Nothing to import.")
        return

    if commit:
        print("\nAppending to Google Sheet...")
        service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{HISTORY_TAB}'!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": all_new_rows},
        ).execute()
        print("Done! Rows appended successfully.")
    else:
        print("\nDry run — use --commit to actually append rows.")


if __name__ == "__main__":
    main()
