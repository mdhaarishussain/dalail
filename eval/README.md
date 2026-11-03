# eval

Retrieval evaluation. Uses `@dalail/core` so the app and the eval share one implementation.

Phase 1 adds `questions.fixture.yaml` (fixture queries → expected node ids) and a runner reporting
top-1, top-3, ambiguous rate and no-match rate. Phase 5 adds `bakeoff/` for candidate LLMs.
