from __future__ import annotations

from collections import Counter, defaultdict

from .corpus import Corpus


def stats_text(corpus: Corpus) -> str:
    by_topic: dict[str, Counter[str]] = defaultdict(Counter)
    alias_counts: list[int] = []
    no_follow: list[str] = []
    for d in corpus.nodes:
        by_topic[str(d.data.get("topic"))][str(d.data.get("status"))] += 1
        alias_counts.append(len(d.data.get("claim_roman_urdu") or []))
        if not d.data.get("follow_ups"):
            no_follow.append(d.id)
    lines = [
        f"corpus_version {corpus.corpus_version}",
        "",
        f"{'topic':<14}{'nodes':>6}{'verified':>10}{'draft':>7}{'review':>8}{'verified %':>12}",
    ]
    for topic, c in sorted(by_topic.items()):
        total = sum(c.values())
        pct = 100 * c["verified"] / total if total else 0
        lines.append(f"{topic:<14}{total:>6}{c['verified']:>10}{c['draft']:>7}{c['under_review']:>8}{pct:>11.0f}%")
    if alias_counts:
        lines += [
            "",
            f"aliases per node: min {min(alias_counts)}, max {max(alias_counts)}, "
            f"mean {sum(alias_counts) / len(alias_counts):.1f}",
        ]
    lines.append(f"hadith files: {len(corpus.hadith)}; quran rows: {len(corpus.quran)}")
    lines.append(f"nodes without follow-ups ({len(no_follow)}): {', '.join(sorted(no_follow)) or '-'}")
    return "\n".join(lines)
