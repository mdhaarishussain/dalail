# e5 reference check (one-off, not part of CI)

Confirms the pinned GGUF (`config/models.json`) embeds like the official
`intfloat/multilingual-e5-small`. Needs a throwaway venv with `torch` (CPU) and
`sentence-transformers`; these are deliberately **not** project dependencies.

```bash
python ref.py strings.json > ref.json                      # throwaway venv
../../.venv/bin/python gguf.py strings.json ../../../models/multilingual-e5-small-q8_0.gguf > gguf.json
python -c 'import json;a=json.load(open("ref.json"));b=json.load(open("gguf.json"));print(min(sum(x*y for x,y in zip(u,v)) for u,v in zip(a,b)))'
```

Result on 2026-11-03: min cosine 0.9952, mean 0.9985 over 20 neutral strings (threshold 0.99).
