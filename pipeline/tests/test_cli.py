import pytest

from dalail_pipeline import __version__
from dalail_pipeline.cli import COMMANDS, build_parser, main


def test_help_lists_all_commands(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        build_parser().parse_args(["--help"])
    assert exc.value.code == 0
    out = capsys.readouterr().out
    for name in COMMANDS:
        assert name in out


def test_version() -> None:
    assert __version__ == "0.0.0"


def test_build_requires_mode() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args(["build"])


def test_validate_command_on_repo_fixtures(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["validate"]) == 0
    assert "12 node(s) in scope, 0 error(s)" in capsys.readouterr().out


def test_validate_prod_fails_on_fixture_only_corpus(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["validate", "--prod"]) == 1
    assert "PROD_EMPTY" in capsys.readouterr().err
