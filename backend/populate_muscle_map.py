"""One-time script to populate the Muscle Map tab in Google Sheets."""
import sheets_client

MUSCLE_MAP_TAB = "Muscle Map"

HEADER = ["Exercise", "Primary", "Secondary", "Weights", "Secondary Weights"]

# Unique exercises across all workout types with muscle mappings
# Primary muscles get explicit weights, secondary muscles get secondary weights
# Slugs: chest, front-deltoids, back-deltoids, biceps, triceps, forearm,
#         trapezius, upper-back, lower-back, abs, obliques,
#         quadriceps, hamstring, gluteal, calves, adductor, abductors

EXERCISES = [
    # === UPPER PRESSING ===
    # Bench Press (flat) — primary chest, secondary front delts + triceps
    ["Bench", "chest, front-deltoids, triceps", "", "1.0, 0.6, 0.5", ""],
    # OHP — primary front delts + triceps, secondary chest + trapezius
    ["OHP", "front-deltoids, triceps", "chest, trapezius", "1.0, 0.7", "0.3, 0.3"],
    # Skull Crushers — primary triceps, secondary chest
    ["Skull", "triceps", "chest", "1.0", "0.2"],
    # French Press (overhead tricep extension) — primary triceps
    ["French Press", "triceps", "", "1.0", ""],
    ["French", "triceps", "", "1.0", ""],
    # Tri (tricep pushdown) — primary triceps
    ["Tri", "triceps", "", "1.0", ""],
    # Pullover — primary chest + lats
    ["Pullover", "chest, upper-back", "triceps", "0.8, 0.8", "0.3"],

    # === UPPER PULLING ===
    # Chin-ups — primary lats + biceps, secondary upper back
    ["Chin", "upper-back, biceps", "forearm", "1.0, 0.8", "0.3"],
    # Pull-ups — primary lats + upper back, secondary biceps
    ["Pullup", "upper-back, biceps", "forearm", "1.0, 0.6", "0.3"],
    ["Pull Ups", "upper-back, biceps", "forearm", "1.0, 0.6", "0.3"],
    # DB Row — primary upper back + lats, secondary biceps + rear delts
    ["DB Row", "upper-back, back-deltoids", "biceps, forearm", "1.0, 0.7", "0.5, 0.3"],
    # Ring Row — primary upper back, secondary biceps + rear delts
    ["Ring Row", "upper-back, back-deltoids", "biceps", "1.0, 0.7", "0.5"],
    # Curl — primary biceps, secondary forearm
    ["Curl", "biceps", "forearm", "1.0", "0.3"],
    # Hammer Curl — primary biceps + forearm
    ["Hammer", "biceps, forearm", "", "1.0, 0.7", ""],
    # Wrist (wrist curl) — primary forearm
    ["Wrist", "forearm", "", "1.0", ""],

    # === SHOULDERS / TRAPS ===
    # Face Pulls — primary rear delts + upper back, secondary trapezius
    ["Face", "back-deltoids, upper-back", "trapezius", "1.0, 0.6", "0.3"],
    # Lu Raise (lateral raise) — primary side delts (mapped to front-deltoids)
    ["Lu", "front-deltoids", "trapezius", "1.0", "0.2"],
    # Shrug — primary trapezius
    ["Shrug", "trapezius", "forearm", "1.0", "0.2"],
    # Neck — primary neck (no slug, map to trapezius as closest)
    ["Neck", "trapezius", "", "0.5", ""],

    # === LOWER BODY ===
    # Squat — primary quads + glutes, secondary hamstrings + abs
    ["Squat", "quadriceps, gluteal", "hamstring, abs", "1.0, 0.8", "0.4, 0.2"],
    ["Squats", "quadriceps, gluteal", "hamstring, abs", "1.0, 0.8", "0.4, 0.2"],
    # Front Squat — primary quads, secondary glutes + abs
    ["Front Squat", "quadriceps, abs", "gluteal", "1.0, 0.5", "0.5"],
    # Deadlift — primary hamstrings + glutes + lower back, secondary quads + trapezius
    ["Deadlift", "hamstring, gluteal, lower-back", "quadriceps, trapezius, forearm", "1.0, 0.8, 0.8", "0.4, 0.3, 0.3"],
    # SL Deadlift (Stiff-Leg) — primary hamstrings + glutes, secondary lower back
    ["SL Deadlift", "hamstring, gluteal", "lower-back", "1.0, 0.8", "0.6"],
    # Calf Raise
    ["Calf", "calves", "", "1.0", ""],

    # === CORE ===
    # Leg Raise (hanging) — primary abs, secondary obliques
    ["Leg Raise", "abs", "obliques", "1.0", "0.3"],
    # Lying Leg Raise — primary abs, secondary obliques
    ["Lying Leg Raise", "abs", "obliques", "1.0", "0.4"],
    # Crunch — primary abs
    ["Crunch", "abs", "obliques", "1.0", "0.2"],
    # Pause Squat — same as squat
    ["Pause Squat", "quadriceps, gluteal", "hamstring, abs", "1.0, 0.8", "0.4, 0.2"],
]


def main():
    rows = [HEADER] + EXERCISES
    # Clear existing data and write fresh
    try:
        existing = sheets_client.fetch_tab(MUSCLE_MAP_TAB)
        print(f"Existing Muscle Map tab has {len(existing)} rows, overwriting...")
    except Exception:
        print("Muscle Map tab not found — you'll need to create it first in Google Sheets")
        print("Then re-run this script.")
        return

    # Use the sheets API to clear and rewrite
    service = sheets_client._get_service()

    # Clear the tab
    service.spreadsheets().values().clear(
        spreadsheetId=sheets_client.SPREADSHEET_ID,
        range=f"'{MUSCLE_MAP_TAB}'",
    ).execute()

    # Write all rows
    service.spreadsheets().values().update(
        spreadsheetId=sheets_client.SPREADSHEET_ID,
        range=f"'{MUSCLE_MAP_TAB}'!A1",
        valueInputOption="RAW",
        body={"values": rows},
    ).execute()

    sheets_client.invalidate_cache()
    print(f"Written {len(EXERCISES)} exercises to Muscle Map tab")


if __name__ == "__main__":
    main()
