# Dalail

Offline-first Android app (Expo / React Native) that matches an opponent's claim — typed in English
or Roman Urdu — to a scholar-verified rebuttal with its dalail and likely follow-ups.

- Rules for contributors and AI agents: [`CLAUDE.md`](CLAUDE.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Decisions: [`docs/decisions/`](docs/decisions/)

```bash
pnpm install
cd pipeline && uv sync && cd ..
bash scripts/ci.sh
```
