from __future__ import annotations

import json
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator


@cache
def validator(corpus_root: Path, name: str) -> Draft202012Validator:
    schema = json.loads((corpus_root / "schema" / f"{name}.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)
