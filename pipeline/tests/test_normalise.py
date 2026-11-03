import json

import pytest

from dalail_pipeline.normalise import default_normaliser
from dalail_pipeline.paths import find_repo_root, normalise_dir

GOLDEN = json.loads((normalise_dir(find_repo_root()) / "normalise.golden.json").read_text())["cases"]


@pytest.mark.parametrize("case", GOLDEN, ids=[c["rule"] for c in GOLDEN])
def test_golden_parity_with_typescript(case: dict[str, str]) -> None:
    n = default_normaliser()(case["input"])
    assert (n.norm, n.folded) == (case["norm"], case["folded"])
