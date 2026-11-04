# Kayfiyyah playlist (Gemini, unverified)

Transcripts and argument maps from the YouTube playlist [How to Debate the So-called Salafiyyah](https://www.youtube.com/playlist?list=PLkAW17wfktA6qF465PyPfc0-M1xNRj2Or) (channel: Knowledge, 103 videos). The videos are an English reading of, and commentary on, the book *Al-Kayfiyyah* (Taibah Books). Processed with Google Gemini from 2026-11-03.

> **Status: unverified research material.** Gemini wrote every transcript, quote and timestamp. Nothing here has been reviewed by a scholar, it is not part of `corpus/`, and the pipeline does not read it. The speaker is not named in the videos or descriptions; have the scholars confirm the speaker and his affiliation before treating any of this as the Ahl-e-Sunnat position.

## Layout

| Path | Contents |
| --- | --- |
| `queue.yaml` | All 103 playlist videos with Gemini's tiers (A: tawassul, istighatha, worship, bid'ah, mawlid, takfir, debating method; B: attributes / istiwa / tajseem) |
| `transcripts/<source_id>.md` | Frontmatter (incl. `playlist_index`, `coverage`) + timestamped English transcript. Long videos are in two parts in one file |
| `registry/bd-bidah.yaml` | Gemini's summary of the bid'ah block (#38, #43, #58, #83, #84, #85): claims, counter-questions and debate tips. Every ID in it matches the extraction files |
| `extractions/<source_id>.yaml` | Moves, provisional claim IDs (`<TOPIC>-WH-K##`), counter-questions (`CQ-K##`) and `debate_tips` |

Claim and counter-question IDs use a separate `K` series so they do not clash with `research/munazara/registry/claims.yaml`; they still need reconciling.

## Checks done

- All 103 queue video IDs resolve on YouTube. Gemini's first queue had 24 wrong IDs (15 misread from screenshots, mostly I/l, and 9 made up for #66–#74); they were corrected in `queue.yaml` from the live playlist.
- Every transcript runs to within about a minute of the video's end, at 100–147 words per minute (near-complete speech), with no "…" and no jump over 90 seconds between lines.
- Every `quote` in every extraction is an exact substring of its transcript. Gemini's first extractions for #2 and #8 failed this and were re-issued.
- All extraction files parse as YAML. One syntax fix: in #8, `CQ-K08`'s `summary_en` had text after the closing quote; it was moved inside the quotes. In #84, six values were wrapped in double quotes because unquoted colons or apostrophes broke the YAML; the text is unchanged. In #70, one quote had its parts reordered (Arabic citation moved to the end); it was replaced with the exact transcript passage. In #71, Gemini dropped the opening `---` of the header (added back) and used non-standard header values (`source_kind: video`, `coverage: complete`, `transcript_origin: youtube_auto`, `transcript_quality: high`); the transcript itself passes every check. #81 (3 Easy Ways to Smash a Wahhabi!) is a longer separate upload of the same section read in #2, with extended commentary; its header was re-issued in the standard format (the opening `---` was added).
- #30 has two lines spanning about two minutes each (the speaker counting down while waiting for audience answers); there are no unmarked gaps.
- #37 (Defending the Mawlid) is less complete: 00:02:35–00:03:31 is marked not transcribed, and 00:18:57–00:22:40 is somewhat condensed (about 70 words a minute against about 130 normally). #36 was re-transcribed after an earlier condensed span was found.
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
| 31 | [yt-5fuZFtI9QnU](transcripts/yt-5fuZFtI9QnU.md) · [yaml](extractions/yt-5fuZFtI9QnU.yaml) | [Defending Tawassul (2): Its Linguistic and Religious Meanings](https://www.youtube.com/watch?v=5fuZFtI9QnU) | 00:43:11 | 20 | 14 | 3 | 5 | TW, DM |
| 35 | [yt-sjbybbsl-gs](transcripts/yt-sjbybbsl-gs.md) · [yaml](extractions/yt-sjbybbsl-gs.yaml) | [Questions, Answers and Pointers in Debate (Part 2: History of Wahhabism/God Existing Without Place)](https://www.youtube.com/watch?v=sjbybbsl-gs) | 00:43:25 | 20 | 14 | 3 | 5 | SF, DM, AH |
| 36 | [yt-11Sayu5WRB0](transcripts/yt-11Sayu5WRB0.md) · [yaml](extractions/yt-11Sayu5WRB0.yaml) | [What Do You Do if Your Opponent Commits Kufr (blasphemy; disbelief)?](https://www.youtube.com/watch?v=11Sayu5WRB0) | 00:35:59 | 20 | 13 | 3 | 6 | TK, DM, AH |
| 37 | [yt-aBtfpl43rtk](transcripts/yt-aBtfpl43rtk.md) · [yaml](extractions/yt-aBtfpl43rtk.yaml) | [Defending the Mawlid](https://www.youtube.com/watch?v=aBtfpl43rtk) | 00:25:05 | 20 | 13 | 3 | 5 | BD, SF, DM |
| 38 | [yt-E5b1NEh5Wng](transcripts/yt-E5b1NEh5Wng.md) · [yaml](extractions/yt-E5b1NEh5Wng.yaml) | [Bid^ah (innovation) Linguistically and Religiously (Part 1)](https://www.youtube.com/watch?v=E5b1NEh5Wng) | 00:37:08 | 30 | 7 | 3 | 5 | BD, CL, DM |
| 43 | [yt-ChDIrtcSy_U](transcripts/yt-ChDIrtcSy_U.md) · [yaml](extractions/yt-ChDIrtcSy_U.yaml) | [Examples of Good Bid^ah (Innovations)](https://www.youtube.com/watch?v=ChDIrtcSy_U) | 00:33:32 | 22 | 5 | 3 | 4 | BD, CL, DM |
| 58 | [yt-WJeUSc3At0Y](transcripts/yt-WJeUSc3At0Y.md) · [yaml](extractions/yt-WJeUSc3At0Y.yaml) | [The Linguistic Meaning of Bid^ah](https://www.youtube.com/watch?v=WJeUSc3At0Y) | 00:07:24 | 11 | 0 | 1 | 2 | BD, CL, DM |
| 83 | [yt-Ac4Z45Y5ZXc](transcripts/yt-Ac4Z45Y5ZXc.md) · [yaml](extractions/yt-Ac4Z45Y5ZXc.yaml) | [Even Ibn Taymiyah Said There are Two Kinds of Religious Innovation: Good and Bad](https://www.youtube.com/watch?v=Ac4Z45Y5ZXc) | 00:35:09 | 25 | 0 | 2 | 4 | BD, CL, DM |
| 84 | [yt-pvffugKYs1U](transcripts/yt-pvffugKYs1U.md) · [yaml](extractions/yt-pvffugKYs1U.yaml) | [Umar's Commanding the Muslims to Pray Exactly 20 Rak^ats Behind One Imam was Such a Good Innovation](https://www.youtube.com/watch?v=pvffugKYs1U) | 00:48:51 | 24 | 1 | 3 | 4 | BD, CL, DM |
| 85 | [yt-AxzGS0G-SFo](transcripts/yt-AxzGS0G-SFo.md) · [yaml](extractions/yt-AxzGS0G-SFo.yaml) | [Good Innovations: Dotting the Qur'an & Mawlid. Bad Innovation: Three Aspects of TawHeed](https://www.youtube.com/watch?v=AxzGS0G-SFo) | 00:41:34 | 21 | 4 | 3 | 4 | BD, CL, DM |
| 41 | [yt-ENHmxPv9Jn0](transcripts/yt-ENHmxPv9Jn0.md) · [yaml](extractions/yt-ENHmxPv9Jn0.yaml) | [Defending Wearing Written Words for Protection (Hirz)](https://www.youtube.com/watch?v=ENHmxPv9Jn0) | 00:17:58 | 14 | 4 | 2 | 4 | HZ, TB, DM |
| 44 | [yt-UurEmkkKLAg](transcripts/yt-UurEmkkKLAg.md) · [yaml](extractions/yt-UurEmkkKLAg.yaml) | [Reciting at the Graves](https://www.youtube.com/watch?v=UurEmkkKLAg) | 00:11:30 | 13 | 4 | 2 | 4 | GV, TB, BD |
| 46 | [yt-2V_9e3a21JI](transcripts/yt-2V_9e3a21JI.md) · [yaml](extractions/yt-2V_9e3a21JI.yaml) | [Questions, Answers and Pointers in Debate (Part 4: the Hadith Nuzool [Descent])](https://www.youtube.com/watch?v=2V_9e3a21JI) | 47:09 | 23 | 8 | 5 | 6 | hadith an-nuzul, hadhf al-mudaf, attributes of Allah, Allah exists without a place, debate tactics |
| 57 | [yt-mE4UXq4gg4A](transcripts/yt-mE4UXq4gg4A.md) · [yaml](extractions/yt-mE4UXq4gg4A.yaml) | [Defending Tawassul (3)  Calling Other than Allah is not Shirk, nor is Seeking Help from a Creation](https://www.youtube.com/watch?v=mE4UXq4gg4A) | 00:27:12 | 19 | 7 | 5 | 6 | tawassul, istighathah, calling other than Allah, hadith of the blind man, ibn taymiyyah, arabic grammar |
| 60 | [yt-GVm72DxVw8Y](transcripts/yt-GVm72DxVw8Y.md) · [yaml](extractions/yt-GVm72DxVw8Y.yaml) | [Blind Following](https://www.youtube.com/watch?v=GVm72DxVw8Y) | 00:12:00 | 13 | 5 | 5 | 5 | TQ, BF |
| 61 | [yt-LWPjg9IGjSM](transcripts/yt-LWPjg9IGjSM.md) · [yaml](extractions/yt-LWPjg9IGjSM.yaml) | [Is It Proper to Use the Name WAHHABIYY??](https://www.youtube.com/watch?v=LWPjg9IGjSM) | 00:25:11 | 13 | 5 | 4 | 5 | WH, NM |
| 69 | [yt-7igS3pwMQgI](transcripts/yt-7igS3pwMQgI.md) · [yaml](extractions/yt-7igS3pwMQgI.yaml) | [When a Person Thinks He's a Muslim but He Needs to Retake His Shahadah](https://www.youtube.com/watch?v=7igS3pwMQgI) | 00:55:56 | 19 | 6 | 5 | 5 | TK, SH |
| 70 | [yt-XCM5aPWZBvA](transcripts/yt-XCM5aPWZBvA.md) · [yaml](extractions/yt-XCM5aPWZBvA.yaml) | [Over Ten Tips for Debating (Wahhabis or Others), Including: NOT MAKING YOUR OPPONENT SAY BLASPHEMY!](https://www.youtube.com/watch?v=XCM5aPWZBvA) | 00:44:08 | 20 | 6 | 5 | 6 | DB, TK |
| 71 | [yt-P77-evJw8Bo](transcripts/yt-P77-evJw8Bo.md) · [yaml](extractions/yt-P77-evJw8Bo.yaml) | [Keeping Control of the Discussion with a Wahhabi](https://www.youtube.com/watch?v=P77-evJw8Bo) | 00:30:02 | 22 | 6 | 5 | 6 | DB, AQ |
| 81 | [yt-oTStqTy42wA](transcripts/yt-oTStqTy42wA.md) · [yaml](extractions/yt-oTStqTy42wA.yaml) | [3 Easy Ways to Smash a Wahhabi!](https://www.youtube.com/watch?v=oTStqTy42wA) | 00:29:20 | 14 | 6 | 5 | 6 | DB, AQ |
| 86 | [yt-dOdxjYi7tiE](transcripts/yt-dOdxjYi7tiE.md) · [yaml](extractions/yt-dOdxjYi7tiE.yaml) | [How Wahhabis Misunderstand Worship and Mislabel Shirk](https://www.youtube.com/watch?v=dOdxjYi7tiE) | 00:40:03 | 16 | 5 | 4 | 5 | DB, SH, TW |
| 87 | [yt-kuCl40KK2_Q](transcripts/yt-kuCl40KK2_Q.md) · [yaml](extractions/yt-kuCl40KK2_Q.yaml) | [Tawassul is Valid, Even by Those Who Are Not Alive or Not Present](https://www.youtube.com/watch?v=kuCl40KK2_Q) | 00:46:12 | 17 | 5 | 4 | 4 | DB, TW, SH |
