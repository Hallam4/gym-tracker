"""Tests for prehab session serialization/parsing and persistence logic."""
import prehab
from models import PrehabCompleteRequest, PrehabSectionProgress


def _req(date="2026-06-29", sh=(4, 4), lb=(3, 3), pr=(1, 1), done=8, total=8):
    return PrehabCompleteRequest(
        date=date, done=done, total=total,
        sections={
            "shoulders": PrehabSectionProgress(done=sh[0], total=sh[1]),
            "lowerback": PrehabSectionProgress(done=lb[0], total=lb[1]),
            "proprioception": PrehabSectionProgress(done=pr[0], total=pr[1]),
        },
    )


def test_prehab_row_serializes_in_order():
    assert prehab.prehab_row(_req()) == ["2026-06-29", "4/4", "3/3", "1/1", "8/8"]


def test_parse_prehab_row_roundtrip():
    s = prehab.parse_prehab_row(prehab.prehab_row(_req(sh=(2, 4), done=6, total=8)))
    assert s is not None
    assert s.date == "2026-06-29"
    assert (s.done, s.total) == (6, 8)
    assert (s.sections["shoulders"].done, s.sections["shoulders"].total) == (2, 4)


def test_parse_prehab_row_header_and_blank_return_none():
    assert prehab.parse_prehab_row(prehab.PREHAB_HEADER) is None
    assert prehab.parse_prehab_row([]) is None
    assert prehab.parse_prehab_row(["", "", ""]) is None


def test_find_row_index_hit_and_miss():
    rows = [
        prehab.PREHAB_HEADER,
        ["2026-06-28", "1/1", "0/0", "0/0", "1/8"],
        ["2026-06-29", "4/4", "3/3", "1/1", "8/8"],
    ]
    assert prehab.find_row_index(rows, "2026-06-29") == 2
    assert prehab.find_row_index(rows, "2026-01-01") is None


def test_get_prehab_sessions_orders_desc_and_limits(monkeypatch):
    rows = [
        prehab.PREHAB_HEADER,
        ["2026-06-27", "1/1", "0/0", "0/0", "1/8"],
        ["2026-06-29", "4/4", "3/3", "1/1", "8/8"],
        ["2026-06-28", "2/4", "0/0", "0/0", "2/8"],
    ]
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", lambda tab: rows)
    out = prehab.get_prehab_sessions(limit=2)
    assert [s.date for s in out] == ["2026-06-29", "2026-06-28"]


def test_get_prehab_sessions_empty_on_error(monkeypatch):
    def boom(tab):
        raise RuntimeError("no tab")
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", boom)
    assert prehab.get_prehab_sessions() == []


def test_save_prehab_session_appends_when_absent(monkeypatch):
    appended = []
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", lambda tab: [prehab.PREHAB_HEADER])
    monkeypatch.setattr(prehab.sheets_client, "append_rows", lambda tab, r: appended.extend(r))
    monkeypatch.setattr(prehab.sheets_client, "write_cells", lambda tab, u: (_ for _ in ()).throw(AssertionError("must not write_cells")))
    prehab.save_prehab_session(_req(date="2026-06-29"))
    assert appended == [["2026-06-29", "4/4", "3/3", "1/1", "8/8"]]


def test_save_prehab_session_overwrites_existing_date(monkeypatch):
    rows = [prehab.PREHAB_HEADER, ["2026-06-29", "1/4", "0/0", "0/0", "1/8"]]
    writes = []
    monkeypatch.setattr(prehab.sheets_client, "fetch_tab", lambda tab: rows)
    monkeypatch.setattr(prehab.sheets_client, "append_rows", lambda tab, r: (_ for _ in ()).throw(AssertionError("must not append")))
    monkeypatch.setattr(prehab.sheets_client, "write_cells", lambda tab, u: writes.extend(u))
    prehab.save_prehab_session(_req(date="2026-06-29"))
    assert {w["row"] for w in writes} == {1}
    assert [w["value"] for w in writes] == ["2026-06-29", "4/4", "3/3", "1/1", "8/8"]


def test_get_prehab_history_endpoint(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    from models import PrehabSession, PrehabSectionProgress
    sess = PrehabSession(
        date="2026-06-29", done=8, total=8,
        sections={
            "shoulders": PrehabSectionProgress(done=4, total=4),
            "lowerback": PrehabSectionProgress(done=3, total=3),
            "proprioception": PrehabSectionProgress(done=1, total=1),
        },
    )
    monkeypatch.setattr(main.prehab, "get_prehab_sessions", lambda limit=30: [sess])
    res = TestClient(main.app).get("/api/prehab/history")
    assert res.status_code == 200
    body = res.json()
    assert body["sessions"][0]["date"] == "2026-06-29"
    assert body["sessions"][0]["sections"]["shoulders"]["done"] == 4


def test_complete_prehab_endpoint(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    captured = {}
    monkeypatch.setattr(main.prehab, "save_prehab_session", lambda req: captured.update(req=req))
    main.app.dependency_overrides[main._require_api_key] = lambda: None
    try:
        res = TestClient(main.app).post("/api/prehab/complete", json={
            "date": "2026-06-29", "done": 8, "total": 8,
            "sections": {
                "shoulders": {"done": 4, "total": 4},
                "lowerback": {"done": 3, "total": 3},
                "proprioception": {"done": 1, "total": 1},
            },
        })
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
        assert captured["req"].date == "2026-06-29"
    finally:
        main.app.dependency_overrides.clear()
