# Real eval questions (`questions.real.yaml`)

This file measures how well Dalail answers **the way real people actually ask**. It is only useful
if it stays independent of the corpus, so:

1. **Human-written only.** Questions are typed or collected by people: the owner, scholars,
   testers, or exported from the app's saved "no match" questions. Write them as the person
   typed them, misspellings included.
2. **Never generated or edited by Claude or any tool.** No AI-written, paraphrased, "cleaned up"
   or translated questions. Claude may read this file and report on it, never write to it.
3. **Never copied from aliases.** `claim_roman_urdu` phrasings are written during ingestion to help
   search; copying them here would test the index against itself. `python -m dalail_pipeline
validate` fails with `EVAL_LEAK` if a question equals an alias or claim, or nearly equals one
   after Roman Urdu normalisation (thresholds in `eval/config.json`).
4. Every entry records `added_by`, `added_on` and `origin`.

The fixture set (`questions.fixture.yaml`) is separate and is reported separately; it only checks
that the machinery works on fake data.
