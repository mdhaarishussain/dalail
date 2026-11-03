# Munazara research set (Gemini, unverified)

Transcripts and argument maps of 56 YouTube videos, produced with Google Gemini and split into one file per video:

- **Videos 1–46** (first chat): Mufti Rashid Mahmood Razvi's replies and munazaras, and Engineer Muhammad Ali Mirza's own lectures.
- **Videos 47–56** (second chat, "Batch Two Execution"): live munazaras on waseela/tawassul and istighatha, mostly Ahl-e-Sunnat vs Ahl-e-Hadith. Videos 51 and 56 are Ahl-e-Hadith vs Shia debates with no Ahl-e-Sunnat speaker.

> **Status: unverified research material.** Gemini wrote every transcript, quote, timestamp and reference here from audio. None of it has been checked against the videos or reviewed by a scholar. It is **not** part of `corpus/`, the pipeline does not read it, and nothing here may be shown in the app. Use it to find claims, debate sequences and where in a video to look. Anything that becomes a node goes through the normal ingestion and scholar review (see `/CLAUDE.md`).

## Layout

| Path | Contents |
| --- | --- |
| `transcripts/<source_id>.md` | Frontmatter (url, channel, speakers, format, topics) + timestamped Roman Urdu transcript |
| `extractions/<source_id>.yaml` | Moves (claim / response / counter-question), quotes, evidence as spoken, new claims, phrasings |
| `registry/claims.yaml` | Gemini's final claim taxonomy from the first chat (68 claims). Batch 2 extractions use the older seed IDs (TW-C01…TW-C08, IS-C01, IS-C03), which are not defined in this file |
| `registry/counter-questions.yaml` | Gemini's counter-question catalogue (CQ-01 to CQ-40) |
| `registry/snapshots/` | The master registries Gemini output along the way (batch 1 corrected, then at 10, 20, 30 and 40 videos) |
| `notes/turn-NN.md`, `notes/batch2-turn-NN.md` | Everything else Gemini wrote in each chat turn: batch summaries, extra arguments and clashes it found, counter-question themes, errata, video queue and skipped videos |
| `prompts/instructions.md` | The instructions and corrections given to Gemini during the chat |
| `raw/gemini-chat-export-2026-11-03.md`, `raw/gemini-chat-export-batch2-2026-11-03.md` | The full chat exports, untouched (includes earlier drafts, the 10/20/30/40-video registries and queue notes) |

For videos 1 to 5 the files hold the corrected re-issue from turn 2, not the first draft.

## Checks done when splitting

- All 46 video IDs resolve on YouTube, and each title matches the one Gemini recorded (checked via YouTube oEmbed on 2026-11-03). So the videos are real; the transcripts are still unchecked.
- Batch 2: all 10 video IDs resolve on YouTube and their titles match (checked 2026-11-03).
- Every extraction file parses as YAML. 299 moves in total.
- Claim IDs used in extractions but missing from `registry/claims.yaml`: HN-EM-C04, IG-EM-C05, IG-WH-C01, KN-EM-C04, KR-EM-C04, KR-EM-C05, NB-EM-C02, QD-EM-C02, TW-EM-C08.
- In the registry but not used in any extraction: IS-EM-C03, IS-EM-C07, IS-EM-C08, IS-EM-C09, TS-EM-C04, TW-EM-C02, TW-EM-C04.
- All 24 counter-question IDs used in extractions exist in the catalogue.

## Known limits

- Gemini's transcripts changed between drafts of the same video (noted in the chat at turn 3), so treat any quote, book name, volume/page or hadith number as a lead to check, not a citation.
- `[ARABIC RECITATION]` marks where Arabic was spoken; no Arabic text was transcribed.
- Videos 21 onward drift beyond tawassul/istighatha into fiqh masail, Sahaba, khatam-e-nabuwwat and other topics.
- **Claim IDs drifted between Gemini's registries.** The same ID can mean different claims in different files: for example `TW-EM-C01` in `registry/snapshots/master-registry-batch1-corrected.yaml` is not the same claim as `TW-EM-C01` in `registry/claims.yaml`. An ID is only meaningful inside the file it appears in. This is deliberately not fixed here: the claim map will be rebuilt from the Whisper transcripts.
- Many transcripts are partial: see **Coverage** in the Videos table and the **Re-transcribe** list below.

## Local transcription (Whisper)

Machine transcripts made locally with faster-whisper large-v3 go to `transcripts-whisper/<source_id>.md`
(frontmatter `transcript_origin: whisper-large-v3`). They are unverified research too.

1. Put the audio in `research/munazara/audio/` (git-ignored; never commit audio), e.g. `yt-hqDt_1BwzLc.m4a`.
2. From `pipeline/`: `uv sync --extra transcribe`, then `uv run python -m dalail_pipeline fetch-model --transcription` (one-time ~3.1 GB download of the pinned model into `models/`).
3. `uv run python -m dalail_pipeline transcribe ../research/munazara/audio/yt-hqDt_1BwzLc.m4a --source-id yt-hqDt_1BwzLc`
   Runs on CPU (int8); expect roughly real time to a few times slower than the video length.
   Urdu speech comes out in Urdu script and Arabic in Arabic script, exactly as Whisper produces it (nothing is transliterated).
4. Check coverage: `python research/munazara/tools/coverage.py --dir research/munazara/transcripts-whisper`

<!-- coverage:start -->
## Re-transcribe

Generated by `python research/munazara/tools/coverage.py --update-readme`; do not edit by hand.
Coverage = words / (140 × minutes): near-full ≥ 0.75, partial ≥ 0.35, thin below.
Unmarked jumps: timestamp gaps over 2 minutes with no `[skipped …]` / `[not transcribed …]` / `[unclear …]` marker. Mufti Rashid's videos first, then lowest coverage.

26 of 46 transcripts are partial or thin.

| Order | Source | Coverage | Words | Duration | Marked gaps | Unmarked jumps > 2 min |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [yt-2NrUrJqrOyE](transcripts/yt-2NrUrJqrOyE.md) (Mufti Rashid) | thin 0.04 | 453 | 1:21:59 | 0.0 min | 05:06→1:20:21 (75.2 min) |
| 2 | [yt-bpuy1pCuVh8](transcripts/yt-bpuy1pCuVh8.md) (Mufti Rashid) | thin 0.08 | 908 | 1:18:16 | 53.0 min | 02:01→04:14 (2.2 min); 20:25→35:00 (14.6 min); 1:14:01→1:16:37 (2.6 min) |
| 3 | [yt-tXXxl8cwG8s](transcripts/yt-tXXxl8cwG8s.md) (Mufti Rashid) | thin 0.10 | 695 | 49:28 | 0.0 min | 00:13→02:43 (2.5 min); 07:52→16:38 (8.8 min); 19:30→22:03 (2.5 min); 22:19→24:28 (2.1 min); 31:16→49:28 (18.2 min) |
| 4 | [yt-C-p_33jtEFA](transcripts/yt-C-p_33jtEFA.md) (Mufti Rashid) | thin 0.20 | 917 | 33:31 | 0.0 min | 08:14→10:19 (2.1 min); 15:30→18:59 (3.5 min); 18:59→26:00 (7.0 min); 28:40→32:45 (4.1 min) |
| 5 | [yt-f5D6zj2Kr6Y](transcripts/yt-f5D6zj2Kr6Y.md) (Mufti Rashid) | thin 0.21 | 1574 | 54:25 | 3.9 min | 39:58→42:37 (2.6 min); 45:16→47:45 (2.5 min); 50:39→54:00 (3.4 min) |
| 6 | [yt-j8Cj9nOfY3M](transcripts/yt-j8Cj9nOfY3M.md) (Mufti Rashid) | thin 0.26 | 428 | 11:54 | 0.0 min | 07:45→10:14 (2.5 min) |
| 7 | [yt-dUOeaVky6s0](transcripts/yt-dUOeaVky6s0.md) (Mufti Rashid) | thin 0.29 | 901 | 21:54 | 0.0 min | 08:50→15:21 (6.5 min); 19:13→21:54 (2.7 min) |
| 8 | [yt-kkgQeZR2GwQ](transcripts/yt-kkgQeZR2GwQ.md) (Mufti Rashid) | thin 0.29 | 537 | 13:06 | 0.0 min | 10:24→13:06 (2.7 min) |
| 9 | [yt-knUP0hRf7tk](transcripts/yt-knUP0hRf7tk.md) (Mufti Rashid) | thin 0.29 | 1025 | 25:33 | 0.0 min | 12:30→20:29 (8.0 min); 20:29→25:33 (5.1 min) |
| 10 | [yt-qiyNKbLsWEU](transcripts/yt-qiyNKbLsWEU.md) (Mufti Rashid) | thin 0.32 | 981 | 21:43 | 0.5 min | 11:10→13:19 (2.1 min) |
| 11 | [yt-vMA-Vcng63I](transcripts/yt-vMA-Vcng63I.md) (Mufti Rashid) | partial 0.38 | 1031 | 19:31 | 0.0 min | — |
| 12 | [yt-jhP_dOsZ2g4](transcripts/yt-jhP_dOsZ2g4.md) (Mufti Rashid) | partial 0.42 | 1323 | 22:18 | 0.2 min | — |
| 13 | [yt-QTDHnYqPnmc](transcripts/yt-QTDHnYqPnmc.md) (Mufti Rashid) | partial 0.48 | 587 | 08:45 | 0.0 min | — |
| 14 | [yt-2sI73wlBbmk](transcripts/yt-2sI73wlBbmk.md) (Mufti Rashid) | partial 0.52 | 2542 | 34:53 | 0.0 min | 02:11→04:45 (2.6 min); 05:45→08:00 (2.2 min); 08:00→10:05 (2.1 min); 16:45→27:04 (10.3 min); 27:04→30:36 (3.5 min); 30:36→32:41 (2.1 min); 32:41→34:53 (2.2 min) |
| 15 | [yt-hcrjteJMx9c](transcripts/yt-hcrjteJMx9c.md) (Mufti Rashid) | partial 0.60 | 288 | 03:26 | 0.0 min | — |
| 16 | [yt-hqDt_1BwzLc](transcripts/yt-hqDt_1BwzLc.md) (Mufti Rashid) | partial 0.61 | 1384 | 16:09 | 0.1 min | — |
| 17 | [yt-6wVuqbC2cu0](transcripts/yt-6wVuqbC2cu0.md) (Mufti Rashid) | partial 0.63 | 863 | 09:51 | 0.0 min | — |
| 18 | [yt-eol43GtSS9E](transcripts/yt-eol43GtSS9E.md) (Mufti Rashid) | partial 0.65 | 2713 | 29:56 | 0.0 min | 09:14→11:15 (2.0 min); 14:43→16:55 (2.2 min); 16:55→24:16 (7.3 min); 24:16→27:45 (3.5 min); 27:45→29:56 (2.2 min) |
| 19 | [yt-3-tML7NbATk](transcripts/yt-3-tML7NbATk.md) (Mufti Rashid) | partial 0.74 | 2849 | 27:36 | 0.0 min | — |
| 20 | [yt-Fu25DYUAts8](transcripts/yt-Fu25DYUAts8.md) | thin 0.11 | 1318 | 1:27:25 | 76.5 min | — |
| 21 | [yt-od6Z207INRw](transcripts/yt-od6Z207INRw.md) | thin 0.17 | 1005 | 42:09 | 0.0 min | 07:06→09:19 (2.2 min); 12:40→18:20 (5.7 min); 18:20→26:28 (8.1 min); 28:34→32:07 (3.5 min); 35:04→42:09 (7.1 min) |
| 22 | [yt-sAVly9evIpA](transcripts/yt-sAVly9evIpA.md) | thin 0.18 | 747 | 29:15 | 4.2 min | 04:12→07:20 (3.1 min); 20:10→22:30 (2.3 min) |
| 23 | [yt-BdmkNIt2AWw](transcripts/yt-BdmkNIt2AWw.md) | thin 0.22 | 1196 | 38:36 | 3.3 min | 11:35→13:39 (2.1 min); 16:35→23:40 (7.1 min); 24:50→29:40 (4.8 min); 32:05→35:40 (3.6 min) |
| 24 | [yt-0LqCS-zvCxY](transcripts/yt-0LqCS-zvCxY.md) | partial 0.36 | 498 | 09:58 | 0.1 min | 02:28→07:00 (4.5 min) |
| 25 | [yt-j8HMKqpDamg](transcripts/yt-j8HMKqpDamg.md) | partial 0.45 | 1119 | 17:50 | 0.2 min | 15:20→17:40 (2.3 min) |
| 26 | [yt-7BGzswtPMFA](transcripts/yt-7BGzswtPMFA.md) | partial 0.46 | 1081 | 16:42 | 0.0 min | — |
<!-- coverage:end -->

## Quality tiers

| Videos | Tier | Use for |
| --- | --- | --- |
| 1–46 | Research | Claims, debate sequences, leads to Mufti Razvi's answers (still unverified) |
| 47 | Research, partial | A well-known live TV debate (Allama Hisham Elahi Zaheer's channel). Worth keeping, but the transcript stops at 00:23:26 of a 44:37 video, so the second half still needs transcribing |
| 48–56 | **Low quality: opponent phrasing only** | How Ahl-e-Hadith debaters word their objections (claim wording, Roman Urdu search phrasings). Not a source of answers or rebuttals |

Why 48–56 are low quality:

- The transcripts are heavily condensed: about 25 words per minute of video, against about 95 for videos 1–46 and roughly 120–150 in normal speech. Most have no gap markers yet are labelled `transcript_quality: good`, and several lines join separate sentences with "…".
- They are mostly phone-call or channel debates between non-scholars. Several were uploaded by the opposing side with partisan titles, so they may be edited.
- Videos 51 and 56 are Ahl-e-Hadith vs Shia, with no Ahl-e-Sunnat speaker.

## Videos

| # | Files | Notes | Title | Kind | Format | Moves | Topics | Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | [yt-hqDt_1BwzLc](transcripts/yt-hqDt_1BwzLc.md) · [yaml](extractions/yt-hqDt_1BwzLc.yaml) | [turn 2](notes/turn-02.md) | [Anbia Wa Ouliya Say Madad//EITZRAT and JAWABAT//!!Reply To Eng Mirza Jhelumi!!(By Mufti Rashid)](https://www.youtube.com/watch?v=hqDt_1BwzLc) | munazara-transcript | qa | 11 | tawassul, istighatha | partial 0.61 |
| 2 | [yt-3-tML7NbATk](transcripts/yt-3-tML7NbATk.md) · [yaml](extractions/yt-3-tML7NbATk.yaml) | [turn 2](notes/turn-02.md) | [Anbiya Our Auliya Se Madad Mangne Ki Daleel \| Hadees 'Ya IbadAllah A'inuni' by MUFTI RASHID MAHMOOD](https://www.youtube.com/watch?v=3-tML7NbATk) | scholar-lecture | lecture | 13 | partial 0.74 |
| 3 | [yt-vMA-Vcng63I](transcripts/yt-vMA-Vcng63I.md) · [yaml](extractions/yt-vMA-Vcng63I.yaml) | [turn 2](notes/turn-02.md) | [Anbiya Auliya Se Madad Mangna Hadees Pr kalam Reply To Mirza Eng & WAHABI Ahle Hadees By MUFTI RASHI](https://www.youtube.com/watch?v=vMA-Vcng63I) | scholar-lecture | lecture | 6 | istimdad, istighatha, tawassul | partial 0.38 |
| 4 | [yt-sAVly9evIpA](transcripts/yt-sAVly9evIpA.md) · [yaml](extractions/yt-sAVly9evIpA.yaml) | [turn 2](notes/turn-02.md) | [Waseela in Quran \| Waseela se Dua mangna kaisa hai ?? \| Peeri Mureedi By Engineer Muhammad Ali Mirza](https://www.youtube.com/watch?v=sAVly9evIpA) | opponent-scholar | lecture | 7 | thin 0.18 |
| 5 | [yt-0LqCS-zvCxY](transcripts/yt-0LqCS-zvCxY.md) · [yaml](extractions/yt-0LqCS-zvCxY.yaml) | [turn 2](notes/turn-02.md) | [Kya Ya ALI Madad kehna Shirk hai ?? \| Ghair ALLAH se Madad mangna ! \| By Engineer Muhammad Ali Mirza](https://www.youtube.com/watch?v=0LqCS-zvCxY) | opponent-scholar | lecture | 7 | partial 0.36 |
| 6 | [yt-Fu25DYUAts8](transcripts/yt-Fu25DYUAts8.md) · [yaml](extractions/yt-Fu25DYUAts8.yaml) | [turn 3](notes/turn-03.md) | [43-Mas'alah: WASEELAH aur TAWASSUL kay Saheh Ahkam-o-Masa'il (Surah Al Ma'idah Ayat 35)](https://www.youtube.com/watch?v=Fu25DYUAts8) | opponent-scholar | lecture | 7 | tawassul, waseela, istighatha, istimdad | thin 0.11 |
| 7 | [yt-f5D6zj2Kr6Y](transcripts/yt-f5D6zj2Kr6Y.md) · [yaml](extractions/yt-f5D6zj2Kr6Y.yaml) | [turn 4](notes/turn-04.md) | [Anbiya Or Oliya Se Madad Mangny Ki Haqiqat & Dua Ka Mafhom Alesunnat Ka Aqeeda By Mufti Rashid Razvi](https://www.youtube.com/watch?v=f5D6zj2Kr6Y) | scholar-lecture | lecture | 12 | istighatha, istimdad, tawassul | thin 0.21 |
| 8 | [yt-j8HMKqpDamg](transcripts/yt-j8HMKqpDamg.md) · [yaml](extractions/yt-j8HMKqpDamg.yaml) | [turn 5](notes/turn-05.md) | [Ghairullah Say Mangna \| Auliya Say Madad Mangna \| Waseela o Tawassul \| Engineer Muhammad Ali Mirza](https://www.youtube.com/watch?v=j8HMKqpDamg) | opponent-scholar | debate | 10 | partial 0.45 |
| 9 | [yt-oS54i85RCtc](transcripts/yt-oS54i85RCtc.md) · [yaml](extractions/yt-oS54i85RCtc.yaml) | [turn 6](notes/turn-06.md) | [Waliyon Se Madad Maangna Kaisa 😪 By Mufti Rashid Mahmood Razvi\|](https://www.youtube.com/watch?v=oS54i85RCtc) | scholar-lecture | qa | 3 | near-full 1.54 |
| 10 | [yt-QTDHnYqPnmc](transcripts/yt-QTDHnYqPnmc.md) · [yaml](extractions/yt-QTDHnYqPnmc.yaml) | [turn 6](notes/turn-06.md) | [Kya Huzoor ﷺ Ilm-e-Ghaib jaante hain? \|\| Mufti Rashid Mahmood Rizvi](https://www.youtube.com/watch?v=QTDHnYqPnmc) | scholar-lecture | lecture | 3 | partial 0.48 |
| 11 | [yt-hcrjteJMx9c](transcripts/yt-hcrjteJMx9c.md) · [yaml](extractions/yt-hcrjteJMx9c.yaml) | [turn 7](notes/turn-07.md) | [Mufti Rashid Mahmood Rizvi \|New bayan 2023\| ilm e ghaib](https://www.youtube.com/watch?v=hcrjteJMx9c) | scholar-lecture | lecture | 2 | partial 0.60 |
| 12 | [yt-BdmkNIt2AWw](transcripts/yt-BdmkNIt2AWw.md) · [yaml](extractions/yt-BdmkNIt2AWw.yaml) | [turn 7](notes/turn-07.md) | [Nabi ﷺ ka ilm e ghaib \| A complete Lecture on ilm ul Ghaib \| By Engineer Muhammad Ali Mirza](https://www.youtube.com/watch?v=BdmkNIt2AWw) | opponent-scholar | lecture | 8 | thin 0.22 |
| 13 | [yt-QiwVYfUcIEk](transcripts/yt-QiwVYfUcIEk.md) · [yaml](extractions/yt-QiwVYfUcIEk.yaml) | [turn 8](notes/turn-08.md) | [Kaya RASOOL ALLAH(Ap Par Salam)Apnay Nafaa K b Maalik Nhe?Mufti Rashid Mahmood Rizvi](https://www.youtube.com/watch?v=QiwVYfUcIEk) | scholar-lecture | qa | 4 | ikhtiyarat, istimdad, tawassul | near-full 1.19 |
| 14 | [yt-7BGzswtPMFA](transcripts/yt-7BGzswtPMFA.md) · [yaml](extractions/yt-7BGzswtPMFA.yaml) | [turn 8](notes/turn-08.md) | [HAZIR-o-NAZIR kay AQEEDAY ka Haqeeqi BANI kon hai ? (By Engineer Muhammad Ali Mirza)](https://www.youtube.com/watch?v=7BGzswtPMFA) | opponent-scholar | lecture | 5 | hazir-o-nazir | partial 0.46 |
| 15 | [yt-od6Z207INRw](transcripts/yt-od6Z207INRw.md) · [yaml](extractions/yt-od6Z207INRw.yaml) | [turn 9](notes/turn-09.md) | [Ya_RasooLALLAH \|  یا رسول اللہ ﷺ ??? Hazir-o-Nazir & Ilm-e-Ghaib ??? By Engineer Muhammad Ali Mirza](https://www.youtube.com/watch?v=od6Z207INRw) | opponent-scholar | lecture | 6 | thin 0.17 |
| 16 | [yt-jhP_dOsZ2g4](transcripts/yt-jhP_dOsZ2g4.md) · [yaml](extractions/yt-jhP_dOsZ2g4.yaml) | [turn 10](notes/turn-10.md) | [Hazrat Khalid bin Waleed Ki Karamat Quran O Sunnat Ki Toheen? Reply to Eng Ali Mirza By Mufti Rashid](https://www.youtube.com/watch?v=jhP_dOsZ2g4) | munazara-transcript | debate | 7 | karamat, sahaba | partial 0.42 |
| 17 | [yt-z3ttIQXgAxY](transcripts/yt-z3ttIQXgAxY.md) · [yaml](extractions/yt-z3ttIQXgAxY.yaml) | [turn 10](notes/turn-10.md) | [Mufti Rashid Mahmood Razvi vs Eng Ali Mirza About Karamat Oliya ,Reply to Eng Ali Mirza #muftirashid](https://www.youtube.com/watch?v=z3ttIQXgAxY) | munazara-transcript | debate | 2 | karamat | near-full 1.26 |
| 18 | [yt-6wVuqbC2cu0](transcripts/yt-6wVuqbC2cu0.md) · [yaml](extractions/yt-6wVuqbC2cu0.yaml) | [turn 11](notes/turn-11.md) | [Mojza Karamat Khilaf e Shariat Khilaf Aqal Khilaf Adat? Eng Ali Mirza Exposed by Mufti Rashid Rzvi](https://www.youtube.com/watch?v=6wVuqbC2cu0) | munazara-transcript | debate | 5 | karamat | partial 0.63 |
| 19 | [yt-qiyNKbLsWEU](transcripts/yt-qiyNKbLsWEU.md) · [yaml](extractions/yt-qiyNKbLsWEU.yaml) | [turn 11](notes/turn-11.md) | [Nabi Khuda Ke Noor Ka Tukra Hein(Naozbillah)?Reply To Eng Ali Mirza And Sahil Adeem By Mufti Rashid](https://www.youtube.com/watch?v=qiyNKbLsWEU) | munazara-transcript | debate | 5 | nur-o-bashar | thin 0.32 |
| 20 | [yt-knUP0hRf7tk](transcripts/yt-knUP0hRf7tk.md) · [yaml](extractions/yt-knUP0hRf7tk.yaml) | [turn 12](notes/turn-12.md) | [Munazra Mai chishti RasoolAllah Kay Difa Par Aitraaz Ka Jawab Reply To Eng Ali Mirza By Mufti Rashid](https://www.youtube.com/watch?v=knUP0hRf7tk) | munazara-transcript | debate | 6 | tasawwuf, kalimat | thin 0.29 |
| 21 | [yt-j8Cj9nOfY3M](transcripts/yt-j8Cj9nOfY3M.md) · [yaml](extractions/yt-j8Cj9nOfY3M.yaml) | [turn 13](notes/turn-13.md) | [Chishti Rasool Allah kalma (NauzuBillah) ka jawab? Reply by Mufti Rashid Razvi](https://www.youtube.com/watch?v=j8Cj9nOfY3M) | munazara-transcript | debate | 4 | tasawwuf, kalimat | thin 0.26 |
| 22 | [yt-C-p_33jtEFA](transcripts/yt-C-p_33jtEFA.md) · [yaml](extractions/yt-C-p_33jtEFA.yaml) | [turn 13](notes/turn-13.md) | [Kashf Or Ilham Vs Khatam e Nabuwat Par Dhokon Ka Jawab Reply To Eng Ali Mirza By Mufti Rashid Razvi](https://www.youtube.com/watch?v=C-p_33jtEFA) | munazara-transcript | debate | 7 | khatam-e-nabuwwat, karamat | thin 0.20 |
| 23 | [yt-dUOeaVky6s0](transcripts/yt-dUOeaVky6s0.md) · [yaml](extractions/yt-dUOeaVky6s0.yaml) | [turn 14](notes/turn-14.md) | [Qadiani Ahl-e-Qibla & Kalma-go Hain Eng Ali Mirza Ka New Daawa Exposed BY MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=dUOeaVky6s0) | munazara-transcript | debate | 4 | khatam-e-nabuwwat, takfir | thin 0.29 |
| 24 | [yt-kkgQeZR2GwQ](transcripts/yt-kkgQeZR2GwQ.md) · [yaml](extractions/yt-kkgQeZR2GwQ.yaml) | [turn 14](notes/turn-14.md) | [Mukhtar Saqfi Ko Bchane Ke Ley Muslim Ulama Ko Jhota Kah Dia! Eng Ali Mirza Exposed By Mufti rashid](https://www.youtube.com/watch?v=kkgQeZR2GwQ) | munazara-transcript | debate | 5 | khatam-e-nabuwwat, sahaba | thin 0.29 |
| 25 | [yt-2NrUrJqrOyE](transcripts/yt-2NrUrJqrOyE.md) · [yaml](extractions/yt-2NrUrJqrOyE.yaml) | [turn 15](notes/turn-15.md) | [Mola Ali Aur Hazrat Muawiya Ka Asal Ikhtelaf Aur Mirza Ke Jhoot Reply To Mirza Eng By Mufti Rashid](https://www.youtube.com/watch?v=2NrUrJqrOyE) | scholar-lecture | lecture | 3 | sahaba, tareekh | thin 0.04 |
| 26 | [yt-tXXxl8cwG8s](transcripts/yt-tXXxl8cwG8s.md) · [yaml](extractions/yt-tXXxl8cwG8s.yaml) | [turn 15](notes/turn-15.md) | [Golra Sharif Kay Ellamiya Per Eng Ali Mirza Ki Baungiya Exposed By Mufti Rashid Mahmood Razvi. ](https://www.youtube.com/watch?v=tXXxl8cwG8s) | scholar-lecture | lecture | 6 | aqeedah, shirk, kalam | thin 0.10 |
| 27 | [yt-0AHz5FBIBB8](transcripts/yt-0AHz5FBIBB8.md) · [yaml](extractions/yt-0AHz5FBIBB8.yaml) | [turn 16](notes/turn-16.md) | [Eng Ali Mirza Kay Student Sa Raf-Ul-Yadain Ki Hadees Par Ilmi Mubahasa By MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=0AHz5FBIBB8) | munazara-transcript | debate | 12 | fiqh, raf-ul-yadain, namaz, taqleed | near-full 1.02 |
| 28 | [yt-yKVfjqJAMBk](transcripts/yt-yKVfjqJAMBk.md) · [yaml](extractions/yt-yKVfjqJAMBk.yaml) | [turn 17](notes/turn-17.md) | [Rafa-ul-Yadain Kay Tark Ki Hadees Par Eng Ali Mirza Phans Gaya By MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=yKVfjqJAMBk) | munazara-transcript | debate | 9 | fiqh, raf-ul-yadain, sanad, tark-e-raf-ul-yadain | near-full 1.22 |
| 29 | [yt-ECCSYkVnpa4](transcripts/yt-ECCSYkVnpa4.md) · [yaml](extractions/yt-ECCSYkVnpa4.yaml) | [turn 18](notes/turn-18.md) | [Bukhari Main Raful yadain Malik Bin Huwaris Ki Hadees Reply To Eng Ali Mirza By Mufti Rashid Razvi](https://www.youtube.com/watch?v=ECCSYkVnpa4) | munazara-transcript | debate | 9 | fiqh, raf-ul-yadain, bukhari, malik-bin-al-huwayrith | near-full 1.21 |
| 30 | [yt-YHV-xUS4UEQ](transcripts/yt-YHV-xUS4UEQ.md) · [yaml](extractions/yt-YHV-xUS4UEQ.yaml) | [turn 19](notes/turn-19.md) | [Munkir-e-Khatam-e-Nabuwat Mukhtar Saqafi Ka Difa Eng Ali Mirza Ki Zabani Reply By MUFTI RASHID RAZVI](https://www.youtube.com/watch?v=YHV-xUS4UEQ) | munazara-transcript | debate | 10 | khatam-e-nabuwwat, mukhtar-al-thaqafi, wahi, kazzab | near-full 1.04 |
| 31 | [yt-RedTD9XEVIc](transcripts/yt-RedTD9XEVIc.md) · [yaml](extractions/yt-RedTD9XEVIc.yaml) | [turn 20](notes/turn-20.md) | [Kaya IMAM E AZAM ABU HANIFA Qayas Ko Hadith Par Tarjeeh Dety Thy? Mufti Rashid Mahmood Rizvi.](https://www.youtube.com/watch?v=RedTD9XEVIc) | opponent-scholar | clip | 2 | fiqh, usul-al-fiqh, abu-hanifa, qiyas | near-full 0.89 |
| 32 | [yt-Sie_vGnC_kg](transcripts/yt-Sie_vGnC_kg.md) · [yaml](extractions/yt-Sie_vGnC_kg.yaml) | [turn 21](notes/turn-21.md) | ["MINI GOD" Kay Aqeedah Par Engineer Ali Mirza Ki Qalabaziyan By MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=Sie_vGnC_kg) | munazara-transcript | debate | 7 | aqeedah, mini-god, shirk, haqiqi-majazi | near-full 1.20 |
| 33 | [yt-5qcl3CRo6x8](transcripts/yt-5qcl3CRo6x8.md) · [yaml](extractions/yt-5qcl3CRo6x8.yaml) | [turn 22](notes/turn-22.md) | [Kya Yeh Shirk Tha Bis Alkhatib 'ant Ki Sharah Reply To Eng Ali Mirza By MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=5qcl3CRo6x8) | munazara-transcript | debate | 5 | tawheed, shirk, bi'sal-khateebu-anta, tasniyah-zameer | near-full 1.22 |
| 34 | [yt-gPL2u_-SL7Y](transcripts/yt-gPL2u_-SL7Y.md) · [yaml](extractions/yt-gPL2u_-SL7Y.yaml) | [turn 23](notes/turn-23.md) | [Chishti Rasool Allah Ilzam Par Engineer Ali Mirza Clean Bowled By MUFTI RASHID MAHMOOD RAZVI.](https://www.youtube.com/watch?v=gPL2u_-SL7Y) | munazara-transcript | debate | 9 | khatam-e-nabuwwat, chishti-rasool-allah, takfir, molvi-ishaq | near-full 1.29 |
| 35 | [yt-PjouX01pp28](transcripts/yt-PjouX01pp28.md) · [yaml](extractions/yt-PjouX01pp28.yaml) | [turn 24](notes/turn-24.md) | [Hazrat Umar Dar Gae? Reply To Eng Ali Mirza & Rafzi Hassan Allahyari By MUFTI RASHID MAHMOOD RAZVI.](https://www.youtube.com/watch?v=PjouX01pp28) | munazara-transcript | debate | 9 | sahaba, hazrat-umar, bravery-vs-fear, hassan-allahyari | near-full 0.99 |
| 36 | [yt-5ehWHkYA_rs](transcripts/yt-5ehWHkYA_rs.md) · [yaml](extractions/yt-5ehWHkYA_rs.yaml) | [turn 25](notes/turn-25.md) | [Question & Answer Session In Fasilabad City By Mufti Rashid Mahmood Razvi.](https://www.youtube.com/watch?v=5ehWHkYA_rs) | munazara-transcript | qa | 9 | fiqh, ghaus-e-pak, raf-ul-yadain, jam'-bain-as-salatayn | near-full 0.78 |
| 37 | [yt-E1DQoXfwn_E](transcripts/yt-E1DQoXfwn_E.md) · [yaml](extractions/yt-E1DQoXfwn_E.yaml) | [turn 26](notes/turn-26.md) | [Eng Muhammad Ali Mirza Kay Tazadat Vs. Mirza Qadiyani Kay Tazadat By MUFTI RASHID MAHMOOD RAZVI.](https://www.youtube.com/watch?v=E1DQoXfwn_E) | munazara-transcript | debate | 5 | tazadat, contradictions, zakat-denial-takfir, ismat-e-ambiya | near-full 1.12 |
| 38 | [yt-KIY0lKVFzw4](transcripts/yt-KIY0lKVFzw4.md) · [yaml](extractions/yt-KIY0lKVFzw4.yaml) | [turn 27](notes/turn-27.md) | [Sajda Jate Onth ( Camel ) Ki Tarah Na betho Ka Matlab ! Reply to Eng Ali Mirza by Mufti Rashid Razvi](https://www.youtube.com/watch?v=KIY0lKVFzw4) | munazara-transcript | debate | 7 | fiqh, sujud, kneeling-posture, hands-vs-knees | near-full 1.08 |
| 39 | [yt-a1oLH4yNJDs](transcripts/yt-a1oLH4yNJDs.md) · [yaml](extractions/yt-a1oLH4yNJDs.yaml) | [turn 28](notes/turn-28.md) | [Kitab Ul Rad Ala Abi Hanifa ka ilmi Jawab \| Reply to Eng Ali Mirza by Mufti Rashid Mahmood Razvi](https://www.youtube.com/watch?v=a1oLH4yNJDs) | munazara-transcript | debate | 8 | near-full 0.94 |
| 40 | [yt-w9v2LUn2Kjo](transcripts/yt-w9v2LUn2Kjo.md) · [yaml](extractions/yt-w9v2LUn2Kjo.yaml) | [turn 29](notes/turn-29.md) | [Engineer Ali Mirza Ka 5th Imam Kon ?Javaid Ahmad Ghamdi per U Turn \| Exposed by Mufti Rashid Razvi](https://www.youtube.com/watch?v=w9v2LUn2Kjo) | munazara-transcript | debate | 6 | near-full 1.28 |
| 41 | [yt-2sI73wlBbmk](transcripts/yt-2sI73wlBbmk.md) · [yaml](extractions/yt-2sI73wlBbmk.yaml) | [turn 30](notes/turn-30.md) | [RafulYadein Per Engineer Ali Mirza Ke 5 Dhoke! Exposed Imam Malik Ka Moqif By Mufti Rashid Mahmood](https://www.youtube.com/watch?v=2sI73wlBbmk) | munazara-transcript | debate | 8 | fiqh, raf-ul-yadain, 5-dhokay, bukhari-muslim-restriction | partial 0.52 |
| 42 | [yt-La8vJVIL3Zs](transcripts/yt-La8vJVIL3Zs.md) · [yaml](extractions/yt-La8vJVIL3Zs.yaml) | [turn 31](notes/turn-31.md) | [Eng Ali Mirza Ne Hazaro Roze Kharab Kar Dea \| Farz Our Nafal Roza Ka Farq by Mufti Rashid Razvi](https://www.youtube.com/watch?v=La8vJVIL3Zs) | munazara-transcript | debate | 5 | near-full 1.14 |
| 43 | [yt-bpuy1pCuVh8](transcripts/yt-bpuy1pCuVh8.md) · [yaml](extractions/yt-bpuy1pCuVh8.yaml) | [turn 32](notes/turn-32.md) | [Exclusive Podcast Answers About Eng Ali Mirza, Sects, And Blasphemy By MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=bpuy1pCuVh8) | munazara-transcript | debate | 3 | usul, shariah-definition, tasawwuf-vs-fiqh, sects | thin 0.08 |
| 44 | [yt-qNxXG6_seps](transcripts/yt-qNxXG6_seps.md) · [yaml](extractions/yt-qNxXG6_seps.yaml) | [turn 33](notes/turn-33.md) | [Eng Muhammad Ali Mirza our Akhlaq e Nabuwat ka dawa exposed by MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=qNxXG6_seps) | munazara-transcript | debate | 6 | akhlaq-e-nabuwwat, vulgar-language, hypocrisy, derogatory-labels | near-full 1.06 |
| 45 | [yt-eol43GtSS9E](transcripts/yt-eol43GtSS9E.md) · [yaml](extractions/yt-eol43GtSS9E.yaml) | [turn 34](notes/turn-34.md) | [Hazrat Ameer Muawiyah Bary Aqeedah E Ahle Sunnat vs DrTahir ul Qadri \| by Mufti Rashid Mahmood Razvi](https://www.youtube.com/watch?v=eol43GtSS9E) | munazara-transcript | debate | 6 | partial 0.65 |
| 46 | [yt-dD66hGXISp0](transcripts/yt-dD66hGXISp0.md) · [yaml](extractions/yt-dD66hGXISp0.yaml) | [turn 35](notes/turn-35.md) | [Mola Ali Ki Fazilat Mein Ek Jhooti Riwayat Per Rafzi Qari Ahmad Hassan ko Jawab By MUFTI RASHID MAHMOOD RAZVI](https://www.youtube.com/watch?v=dD66hGXISp0) | munazara-transcript | debate | 6 | sahaba, afdaliyyat-e-sahaba, mola-ali-vs-abu-bakr, fabricated-hadith | near-full 1.17 |
| 47 (partial) | [yt-sq2CPVTwIT0](transcripts/yt-sq2CPVTwIT0.md) · [yaml](extractions/yt-sq2CPVTwIT0.yaml) | [batch 2](notes/batch2-turn-01.md) | [وسیلہ کی شرعی حیثیت کیا ؟یاعلی مدد یا رسول مدد کہنا کیسا ہے ؟ لائیو پروگرام میں شدید بحث چھڑ گئی۔](https://www.youtube.com/watch?v=sq2CPVTwIT0) | munazara-transcript | debate | 16 | tawassul, istighatha |
| 48 ⚠️ low quality | [yt--Donk1omKUs](transcripts/yt--Donk1omKUs.md) · [yaml](extractions/yt--Donk1omKUs.yaml) | [batch 2](notes/batch2-turn-01.md) | [MUNAZRA ON ❤️❤️ YA RASOOLALLAHﷺ ❤️❤️  KEHNA KAISA](https://www.youtube.com/watch?v=-Donk1omKUs) | munazara-transcript | debate | 12 | istighatha, tawassul |
| 49 ⚠️ low quality | [yt-SvTDDbl1uYw](transcripts/yt-SvTDDbl1uYw.md) · [yaml](extractions/yt-SvTDDbl1uYw.yaml) | [batch 2](notes/batch2-turn-01.md) | [Barelvi Munazir se Ahle Hadees ulma ki Waseela pr debate \| munazra wasila in Islam ](https://www.youtube.com/watch?v=SvTDDbl1uYw) | munazara-transcript | debate | 9 | istighatha, tawassul |
| 50 ⚠️ low quality | [yt-VwfdF6s7SiY](transcripts/yt-VwfdF6s7SiY.md) · [yaml](extractions/yt-VwfdF6s7SiY.yaml) | [batch 2](notes/batch2-turn-01.md) | [Waseela Ahle Hadees VS Barelwi Munazra part-1](https://www.youtube.com/watch?v=VwfdF6s7SiY) | munazara-transcript | debate | 12 | tawassul, istighatha |
| 51 ⚠️ low quality | [yt-L1jmqPI02aE](transcripts/yt-L1jmqPI02aE.md) · [yaml](extractions/yt-L1jmqPI02aE.yaml) | [batch 2](notes/batch2-turn-01.md) | [BIG DEBATE on Istigatha & Tawasul (Part-1) \| Allama Khalil Ahmed vs Shaykh Hassan Allahyari \|](https://www.youtube.com/watch?v=L1jmqPI02aE) | munazara-transcript | debate | 11 | istighatha, tawassul |
| 52 ⚠️ low quality | [yt-KeGLJ5RdPGg](transcripts/yt-KeGLJ5RdPGg.md) · [yaml](extractions/yt-KeGLJ5RdPGg.yaml) | [batch 2](notes/batch2-turn-02.md) | [Waseela lena  biddat hain ya sunnah?Uthman bin hunaif Tahqeeq.Phone Debate ,Aman Ali Qadri vs Arman ](https://www.youtube.com/watch?v=KeGLJ5RdPGg) | munazara-transcript | debate | 9 | tawassul, istighatha |
| 53 ⚠️ low quality | [yt-LR_8xMq4YTw](transcripts/yt-LR_8xMq4YTw.md) · [yaml](extractions/yt-LR_8xMq4YTw.yaml) | [batch 2](notes/batch2-turn-02.md) | [ Barelwi ki tareekhi dhulai Munazra waseela](https://www.youtube.com/watch?v=LR_8xMq4YTw) | munazara-transcript | debate | 7 | tawassul, istighatha |
| 54 ⚠️ low quality | [yt-thm-cj4jOcM](transcripts/yt-thm-cj4jOcM.md) · [yaml](extractions/yt-thm-cj4jOcM.yaml) | [batch 2](notes/batch2-turn-02.md) | [Ghairullah se madad maangna kaisa. Call debate. Ahlehadees vs barelvi](https://www.youtube.com/watch?v=thm-cj4jOcM) | munazara-transcript | debate | 7 | istighatha, tawassul |
| 55 ⚠️ low quality | [yt-4Jdl8PZ1s10](transcripts/yt-4Jdl8PZ1s10.md) · [yaml](extractions/yt-4Jdl8PZ1s10.yaml) | [batch 2](notes/batch2-turn-02.md) | [\|\| MUNAZRA ON WASEELA AND KAFIR NAIK \|\|](https://www.youtube.com/watch?v=4Jdl8PZ1s10) | munazara-transcript | debate | 6 | tawassul, istighatha |
| 56 ⚠️ low quality | [yt-K-Nv0BQSHiw](transcripts/yt-K-Nv0BQSHiw.md) · [yaml](extractions/yt-K-Nv0BQSHiw.yaml) | [batch 2](notes/batch2-turn-02.md) | [Debate \| Munazra \| Ghair Allah Se Madad Mangana Shirk Ka ? \| Molvi Adnan VS Shaykh Hassan Allahyari](https://www.youtube.com/watch?v=K-Nv0BQSHiw) | munazara-transcript | debate | 8 | istighatha, tawassul |
