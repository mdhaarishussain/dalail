# 0008 — Gemini research set in dev builds only

- Status: Accepted (owner decision, 2026-11-04)
- Amends, for **dev builds only**, how non-negotiables 1, 3 and 4 apply to `research/`.

## Context

`research/munazara/` holds Gemini's transcripts and argument maps of 46 debate videos (unverified).
Re-transcription was dropped; the owner wants to test the app on this real debate content now.

## Decision

- `python -m dalail_pipeline import-research research/munazara` generates
  `corpus/research-import/` (regenerated every run, never hand-edited). Everything it produces has
  `origin: gemini-research`, `status: draft`.
- `build --dev` includes it; `build --prod` never loads it, fails validation if any corpus node
  claims that origin, and its post-build scan fails on any research node, alias, counter-question,
  `counters` edge or `research_json`.
- In the app (dev builds, "Show research content" toggle): research nodes carry an amber banner
  "AI-extracted from video — not verified by scholars". No Quick reply, no Share, no dalil cards:
  Gemini's "evidence as said" is plain text. Mufti Rashid's replies are shown as **candidate
  responses** with a link to the moment in the video (user-initiated, opens YouTube) — never as a
  verified answer.
- Gemini's claim IDs drifted between registries, so the importer ignores them for identity:
  claims are clustered by e5 embedding similarity within the same topic and opponent. Registry
  titles are suggested names only. Merges and borderline pairs are reported for the owner.

## Consequences

- Dev builds show unverified, AI-transcribed text by design; testers must treat it as leads.
- Production is unchanged: verified, scholar-article content only.
