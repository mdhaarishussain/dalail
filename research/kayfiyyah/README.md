# Kayfiyyah playlist (Gemini, unverified)

Transcripts and argument maps from the YouTube playlist [How to Debate the So-called Salafiyyah](https://www.youtube.com/playlist?list=PLkAW17wfktA6qF465PyPfc0-M1xNRj2Or) (channel: Knowledge, 103 videos). The videos are an English reading of, and commentary on, the book *Al-Kayfiyyah* (Taibah Books). Processed with Google Gemini from 2026-11-03.

> **Status: unverified research material.** Gemini wrote every transcript, quote and timestamp. Nothing here has been reviewed by a scholar, it is not part of `corpus/`, and the pipeline does not read it. The speaker is not named in the videos or descriptions; have the scholars confirm the speaker and his affiliation before treating any of this as the Ahl-e-Sunnat position.

## Layout

| Path | Contents |
| --- | --- |
| `queue.yaml` | All 103 playlist videos with Gemini's tiers (A: tawassul, istighatha, worship, bid'ah, mawlid, takfir, debating method; B: attributes / istiwa / tajseem) |
| `transcripts/<source_id>.md` | Frontmatter (incl. `playlist_index`, `coverage`) + timestamped English transcript. Long videos are in two parts in one file |
| `extractions/<source_id>.yaml` | Moves, provisional claim IDs (`<TOPIC>-WH-K##`), counter-questions (`CQ-K##`) and `debate_tips` |

Claim and counter-question IDs use a separate `K` series so they do not clash with `research/munazara/registry/claims.yaml`; they still need reconciling.

## Checks done

- All 103 queue video IDs resolve on YouTube. Gemini's first queue had 24 wrong IDs (15 misread from screenshots, mostly I/l, and 9 made up for #66–#74); they were corrected in `queue.yaml` from the live playlist.
- Every transcript runs to within about a minute of the video's end, at 100–147 words per minute (near-complete speech), with no "…" and no jump over 90 seconds between lines.
- Every `quote` in every extraction is an exact substring of its transcript. Gemini's first extractions for #2 and #8 failed this and were re-issued.
- All extraction files parse as YAML. One syntax fix: in #8, `CQ-K08`'s `summary_en` had text after the closing quote; it was moved inside the quotes.
- #30 has two lines spanning about two minutes each (the speaker counting down while waiting for audience answers); there are no unmarked gaps.
- `transcript_quality` for #8 and #21 still says `fair` from Part 1; both are now complete (Parts 1 and 2).

## Videos

| # | Files | Title | Length | Moves | Claims | CQs | Tips | Topics |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | [yt-5q5Pli0A2e4](transcripts/yt-5q5Pli0A2e4.md) · [yaml](extractions/yt-5q5Pli0A2e4.yaml) | [Three Easy Ways to Smash a Wahhabi](https://www.youtube.com/watch?v=5q5Pli0A2e4) | 00:11:46 | 14 | 3 | 4 | 6 | DM, SF |
| 8 | [yt-u5JNMdZvIGs](transcripts/yt-u5JNMdZvIGs.md) · [yaml](extractions/yt-u5JNMdZvIGs.yaml) | [Explaining Takfīr and Advice when Debating](https://www.youtube.com/watch?v=u5JNMdZvIGs) | 00:49:19 | 17 | 4 | 4 | 11 | TK, DM |
| 10 | [yt-s-WroRPHYew](transcripts/yt-s-WroRPHYew.md) · [yaml](extractions/yt-s-WroRPHYew.yaml) | [the hadith of the blind man](https://www.youtube.com/watch?v=s-WroRPHYew) | 00:08:03 | 9 | 2 | 1 | 1 | TW, IS, IB |
| 13 | [yt-cxxyMl2Th3E](transcripts/yt-cxxyMl2Th3E.md) · [yaml](extractions/yt-cxxyMl2Th3E.yaml) | [Tawassul](https://www.youtube.com/watch?v=cxxyMl2Th3E) | 00:24:29 | 17 | 2 | 3 | 4 | TW, IS, IB |
| 14 | [yt-9RYGaSsYScY](transcripts/yt-9RYGaSsYScY.md) · [yaml](extractions/yt-9RYGaSsYScY.yaml) | [The Meaning of Worship](https://www.youtube.com/watch?v=9RYGaSsYScY) | 00:16:00 | 11 | 3 | 3 | 3 | IB, TW, IS |
| 15 | [yt-FSjs3sdUTNk](transcripts/yt-FSjs3sdUTNk.md) · [yaml](extractions/yt-FSjs3sdUTNk.yaml) | [Calling on the Dead or the Absent](https://www.youtube.com/watch?v=FSjs3sdUTNk) | 00:22:02 | 15 | 3 | 3 | 4 | IS, TW, IB |
| 19 | [yt-k2ZL3Jbwp0I](transcripts/yt-k2ZL3Jbwp0I.md) · [yaml](extractions/yt-k2ZL3Jbwp0I.yaml) | [Defending Tawassul (1): The Meaning of Worship, and Why Tawassul is not Shirk](https://www.youtube.com/watch?v=k2ZL3Jbwp0I) | 00:29:28 | 15 | 1 | 1 | 4 | TW, IB, IS, DM |
| 21 | [yt-iJgAsdXN8ZY](transcripts/yt-iJgAsdXN8ZY.md) · [yaml](extractions/yt-iJgAsdXN8ZY.yaml) | [Questions, Answers and Pointers in Debate (Part 1: Should We Call Ourselves Salafis?)](https://www.youtube.com/watch?v=iJgAsdXN8ZY) | 00:49:43 | 17 | 3 | 2 | 8 | DM, TK, SF |
| 24 | [yt-4DpHuzVZP98](transcripts/yt-4DpHuzVZP98.md) · [yaml](extractions/yt-4DpHuzVZP98.yaml) | [How To Debate with the So-Called Salafiyyah: Review](https://www.youtube.com/watch?v=4DpHuzVZP98) | 00:10:09 | 8 | 2 | 2 | 3 | DM, TK, SF |
| 28 | [yt-mDiU5AEXOZw](transcripts/yt-mDiU5AEXOZw.md) · [yaml](extractions/yt-mDiU5AEXOZw.yaml) | [The Wahhabiyyah: The Origin of Their Name](https://www.youtube.com/watch?v=mDiU5AEXOZw) | 00:13:43 | 11 | 1 | 2 | 3 | DM, TK, SF |
| 29 | [yt-NRX5xOh7wG0](transcripts/yt-NRX5xOh7wG0.md) · [yaml](extractions/yt-NRX5xOh7wG0.yaml) | [Questions, Answers and Pointers in Debate (Part 3: Istiwa' & Hadith of the Slave Girl)](https://www.youtube.com/watch?v=NRX5xOh7wG0) | 00:41:37 | 17 | 2 | 3 | 5 | SF, DM |
| 30 | [yt-VjNHXpkh5us](transcripts/yt-VjNHXpkh5us.md) · [yaml](extractions/yt-VjNHXpkh5us.yaml) | [Defending Tawassul (4): The Truth About the Dead and the Absent!](https://www.youtube.com/watch?v=VjNHXpkh5us) | 00:51:56 | 20 | 13 | 3 | 5 | TW, DM |
