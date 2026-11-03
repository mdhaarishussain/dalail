# Instructions given to Gemini

The owner's own messages to Gemini, copied from the chat export (turns that only said "continue" are left out). The two files attached in turn 1 (`gemini-munazara-prompt`, `debate-map-seed-tawassul-istighatha`) are not in the export.

## Turn 1

SUPPLEMENT — new scholar and new opponent

New source channel: Mufti Rashid Mahmood Razavi (Ahl-e-Sunnat). He has done munazaras and has many videos responding to Engineer Muhammad Ali Mirza and his followers. Search his channel for videos on tawassul, waseela, istighatha, istimdad, "ya rasool allah madad" and ilm-e-ghaib.

2. New opponent: Engineer Muhammad Ali Mirza. Use the side label `ali-mirza` for him and his followers. Do not fold him into `wahhabi` — he presents himself as non-sectarian and his arguments may differ, so keep his claims separate even when they resemble existing ones (link with `similar_to: TW-C0x` instead of `maps_to`).

3. Video formats on this channel:

   - Response videos where Mufti Razavi plays a clip of Mirza and then answers it: transcribe the clip as speaker `Mirza (played clip)`, side `ali-mirza`, with `played_clip: true`; then the response as speaker `Razavi`, side `ahl-e-sunnat`. Each clip → response pair is one claim → response move.

   - Live munazaras: same format as the main prompt.

   - One-sided lectures: `format: lecture`.

4. Also look at Mirza's own videos on these topics (his channel or well-known lectures), so we capture his claims in his own words, not only as clipped by the other side. Mark these `source_kind: opponent-scholar`. Where a claim appears both in his own video and in a clip, record both sources.

5. For Mufti Razavi's responses, record quote, summary_en and evidence_cited carefully. His answers may later be reviewed by our scholars as candidate content, so accuracy and timestamps matter even more here.

6. Mirza's videos cover many topics. Stay on tawassul and istighatha for extraction, but keep a short list of other topics where he and Mufti Razavi clash (video title + topic + URL) for later batches.

7. Same rules as before: verbatim only, no Arabic text, no judging who is right, no answers of your own. Batch of 5, then stop.

## Turn 2

Good first batch — the claim mapping and new Mirza claims are useful. Before continuing, fix these, because every quote will be checked and our scholars will review Mufti Razvi's answers as candidate content:

COMPLETE transcripts, not condensed. Batch 1 skips large stretches (Video 2 jumps 00:02:00 → 00:04:20 → 00:07:50) and quotes stitch separate sentences with "...".

   - Transcribe continuously, start to end. Every gap must be explicit: [skipped: off-topic 12:30–15:10] or [unclear 03:10–03:25].

   - A `quote` must be ONE contiguous passage copied exactly from the transcript. No "...", no joining sentences. If a point spans several passages, make several moves.

   - For long videos, split the transcript into parts across responses (Part 1: 00:00–20:00, Part 2...) rather than shortening it.

2. evidence_cited only from the transcript text. Errors found: V2 M04 lists "Bayhaqi Shu'ab al-Iman 6/128" but the transcript line has no volume/page; V1 M02 lists "Ijma of Salaf Saliheen and Sahaba", which the speaker did not say. Copy references exactly as spoken. Add nothing.

3. Arabic: inside (speaker says: ...) put only reference words (surah, ayat, book, number). A short key phrase as heard (max 8 words) may go in a separate field `phrase_as_heard`. Never transliterate the full text of an ayah or hadith.

4. Neutral summaries. Use "says / argues / cites". Never "refutes", "exposes", "proves", "authentic", "deception", "commandingly". For counter-questions, describe the question and what it asks the opponent to address; drop the "Force: compels the opponent to admit" framing. No LaTeX; plain arrows (→).

5. Who said it. V1's questioner is a host relaying objections ("mukhalifeen aitraaz karte hain"), not Mirza: use `side: host` and mark the claim `reported: true, reported_by: Q`. In V2, Razvi paraphrases Mirza: speaker is Razvi, claim `reported: true`. Only Mirza's own words (his videos or played clips) are `reported: false`. Link reported claims to the matching own-words claim when found.

6. Formats/kinds: add format `qa` (host asks, scholar answers). V1 is `qa`. Use source_kind `scholar-lecture` for Ahl-e-Sunnat lectures (V2, V3), `opponent-scholar` for Mirza's own videos, `munazara-transcript` only for real two-sided debates.

7. One claim = one argument. EM-C01 merges two: (a) "du'a is worship (ad-du'a huwal ibadah), so calling others is shirk" and (b) "calling someone ghaib / beyond means (ma fawq al-asbab) is shirk; within means is fine". Keep (a) as EM-C01, make (b) EM-C05. Re-check all mappings with this rule.

8. Calibrate confidence. Not everything is "high". Book titles, volume/page and hadith numbers are `medium` unless clearly enunciated. Use `low` for fast or overlapping speech.

9. Cross-video links: when a move in one video answers a claim stated in another, add `answers: <claim id>`.

Re-issue batch 1 corrected (V1–V5), then continue.

=== MISSION: Mufti Rashid Mahmood Razvi's full channel ===

Goal: an exceptional corpus covering every topic where Mufti Razvi answers opponents, so our app can handle most debates. For each topic, also capture the opponents' OWN words (Mirza's own videos; other opponents where Razvi responds to them).

How to work — do not stop for my approval between videos:

Build a VIDEO QUEUE of his debate-relevant videos (rebuttals, munazaras, aqeedah Q&A). Order: tawassul/istighatha first, then ilm-e-ghaib, hazir-o-nazir, ikhtiyarat/mukhtar-e-kul, karamat-e-auliya, nur-o-bashar, mawlid, isal-e-thawab/fatiha, ziyarat-e-quboor, ta'zeem/qiyam, then everything else. Fiqh masail (e.g. raf al-yadain) go last, tagged `domain: masail`. Khatam-e-nabuwwat/Qadiani and Sahaba disputes are in scope, tagged by opponent.
Skip: nasheeds, events, bayans with no opposing claims, duplicate re-uploads (list as skipped with reason).
For each topic, also find and process the opponent's own video stating the claims Razvi answers.
Each response: as many complete videos as fit. End every response with:

  PROCESSED: n | QUEUE LEFT: n | NEXT: <video title + URL>

  When I say "continue", resume from NEXT. Only stop to ask me if something genuinely blocks you.

ID scheme:

Topic codes: TW tawassul, IS istighatha/istimdad, IG ilm-e-ghaib, HN hazir-o-nazir, IK ikhtiyarat, KR karamat, NB nur-o-bashar, ML mawlid, IT isal-e-thawab, ZQ ziyarat-e-quboor. Propose a 2-letter code for any new topic.
Claim IDs: <TOPIC>-<OPP>-C## with opponent codes EM (Mirza), WH (wahhabi/ahl-e-hadith), DB (deobandi), SH (shia), QD (qadiani). Keep old IDs (TW-C01, IS-C01, EM-C01...) as `legacy_id`.
Counter-questions: CQ-09 onwards.

Every 10 videos, output a compact MASTER REGISTRY (YAML) so we can resume in a new chat:

claims: id, legacy_id, topic, opponent, summary_en, move_type,

        stated_in [source_id@timestamp], reported_in [...], answered_in [source_id#move_id], counter_questions [CQ-##]

counter_questions: id, topic, summary_en, used_in [source_id#move_id]

sequences: common move orders per topic (plain arrows)

queue: done / remaining / skipped (with reason)

Same rules: verbatim only, no Arabic text, no judging who is right, no grading hadith, no answers of your own.

## Turn 3

Much better — structure, speaker labels, reported flags and the claim split are right. Remaining problems to fix before continuing:

Transcript stability. V3 at 00:05:40 read "Musnad al-Bazzar ... 4975" in your first version and "Ibn Abi Shaybah Al-Musannaf ... 4975" in this one, while your extraction still says Bazzar. A transcript must not change between drafts. Only write what you actually hear at that timestamp. If you are not certain of a book name, volume, page or number, write it as [unclear: book name] / [unclear: number] rather than filling it in.

2. Mark every untranscribed span. V5 jumps 00:02:28 → 00:07:00 and V4 jumps 00:04:12 → 00:07:20 with no marker; V4's last 4 minutes are labelled off-topic. Use [not transcribed 02:28–07:00] for anything you didn't transcribe, and [skipped: off-topic] only for genuinely off-topic content, with a 5-word description of what it was. Honest gaps are fine; silent gaps are not.

3. No "..." inside any quote. One contiguous passage per quote; split into more moves if needed.

4. maps_to vs similar_to: when a claim is the same argument as a registered claim ID, use `maps_to`. Use `similar_to` only for related-but-different arguments. Mirza's own words for IS-EM-C05 must be `maps_to: IS-EM-C05`, not `similar_to: IS-C03`.

5. Registry consistency: every ID used anywhere (TW-EM-C01..C03, IS-EM-C02, etc.) must be defined once in the registry. V1 M01 ("is waseela mandatory in every du'a?") is not the five-forms claim — give it its own ID or mark it as a host question, not a claim. CQ-07 points to V1#M10, which is the Sariyah report — fix it by adding the move for the posture analogy.

6. New move type `support-chain` for a response that defends a narration's chain or grading. `attack-chain` is only for attacking one.

7. No LaTeX in reports; plain text arrows only.

8. Before processing any queued video, confirm the URL opens and the title matches. Drop or replace placeholders like "yt-Mirza-IG01" with real videos.

9. After every 10 videos, output the MASTER REGISTRY as specified earlier (all claims, counter-questions, sequences, queue).

Re-issue only the registry for batch 1 with fixes 4–6 applied (no need to repeat the transcripts unless you change them), then continue with NEXT.

## Turn 4

Keep the current format. Small fixes as you go: V6 line "[00:08:08]" is mis-stamped (belongs in the 00:48 section); no "..." inside quotes; register V6 M06 (Umar would have taken a cup to the grave) as a new claim; CQ-07 points to yt-hqDt_1BwzLc#M12, which doesn't exist — add that move or fix the reference. Then continue with NEXT.

## Turn 6

continue , make the transcripts as detailed as possible

## Turn 24

continue ! this next one has a different opponent

## Turn 25

continue ! this next one has a different opponent

## Turn 36

we have covered a lot , now help me organanize this together to put this onto github !

## Turn 37

see you still made an overview of the stuff

anyway you could push all files directly to github if i connect it with you
