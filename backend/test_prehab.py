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
