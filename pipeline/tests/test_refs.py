from dalail_pipeline.refs import (
    FixtureRef,
    HadithRef,
    QuranRef,
    extract_inline_refs,
    parse_ref,
    quran_ref_problem,
    surah_ayah_counts,
)  # fmt: skip


def test_static_table_shape() -> None:
    counts = surah_ayah_counts()
    assert len(counts) == 114
    assert sum(counts) == 6236


def test_parse() -> None:
    assert parse_ref("quran:2:255") == QuranRef(2, 255, 255)
    assert parse_ref("quran:18:1-10") == QuranRef(18, 1, 10)
    assert parse_ref("hadith:h-0001") == HadithRef("h-0001")
    assert parse_ref("fixture:hadith:3") == FixtureRef("hadith", 3)
    for bad in ("quran:18:10-1", "quran:0:1", "quran:1", "hadith:1", "bukhari:1", ""):
        assert parse_ref(bad) is None


def test_range_check() -> None:
    assert quran_ref_problem(QuranRef(1, 1, 7)) is None
    assert "has 7 ayat" in (quran_ref_problem(QuranRef(1, 1, 8)) or "")
    assert "does not exist" in (quran_ref_problem(QuranRef(115, 1, 1)) or "")


def test_inline() -> None:
    assert extract_inline_refs("x [[quran:1:1]] y [[fixture:quran:2]]") == ["quran:1:1", "fixture:quran:2"]
