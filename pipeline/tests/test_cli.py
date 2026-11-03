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


def test_unimplemented_command_fails_loudly() -> None:
    assert main(["validate"]) != 0
