---
description: Turn a captured scholar article (corpus/sources/<id>) into draft claim→response nodes, verbatim and traceable.
argument-hint: corpus/sources/<source-id>
---

# /ingest-article $ARGUMENTS

You are turning ONE owner-supplied article into **draft** corpus files. Read `/CLAUDE.md` first;
non-negotiable 1 governs everything here. This command is the single exception it allows, and only
under these rules.

## Hard rules (violating any of them is a failure, even if checks pass)

1. **Copy, never write.** `claim_en`, `short_answer`, the `## Response` body, and every hadith field
   (`text_ar`, `translation`, `reference`, `grading`) must be **exact copies** of text in
   `$ARGUMENTS/text.txt`. Do not paraphrase, summarise, shorten mid-sentence, translate, fix
   spelling, modernise, add words, or join sentences that are not adjacent in the article.
   Whitespace differences are the only tolerance.
2. **Never fill gaps from your own knowledge.** No Quran text, hadith text, translation, grading,
   scholar name, book title, page number or citation that is not written in the article or its
   `meta.yaml`. If something is missing, leave it empty and flag it.
3. **`short_answer`** = the article's own most direct 1–3 consecutive sentences answering the claim.
   If the article has no such sentences, set `short_answer: ""`. Never compose one.
4. **Hadith**: one file per hadith the article quotes, in `corpus/hadith/<id>.md`, with the reference
   and grading **exactly as the article writes them**. If the article states no grading, omit the
   `grading` key entirely. Never infer a grading or complete a reference.
5. **Quran**: record only the citations the article itself gives, as `quran:<surah>:<ayah>` or
   `quran:<surah>:<from>-<to>`. Do not add ayat the article doesn't cite. Do not copy Quran text into
   nodes; it comes from `corpus/quran/`.
6. **`follow_ups`** only where the article itself moves from one objection to the next.
7. **Everything is `status: draft`.** Never set `verified`, `verified_by` or `verified_on`.
8. **Never edit** anything in `corpus/sources/`, `eval/questions.real.yaml`, or any existing
   `verified` node. Never copy aliases into any eval file.
9. Write into the article's language as-is. `lang` = the language of the body text.

The only text you author is `claim_roman_urdu` (search phrasings, allowed by non-negotiable 1).

## Steps

1. **Read** `$ARGUMENTS/meta.yaml` and `$ARGUMENTS/text.txt` in full. If `scholar` or `work` in
   `meta.yaml` is empty, note it for the summary (the owner fills these in; don't guess).
2. **Identify** each opponent claim the article answers and the scholar's response to it. A claim
   that the article only mentions in passing, without a response, is not a node.
3. **Check for existing nodes** with the same objection: `uv run python -m dalail_pipeline dedupe`
   (from `pipeline/`) and grep `corpus/nodes/`. If one exists, don't create a duplicate; list it
   in the summary as "alias merge suggested".
4. **Get ids**: `uv run python -m dalail_pipeline next-id node --topic <topic>` and
   `... next-id hadith`. Topics/opponents must already exist in `corpus/topics.yaml` /
   `corpus/opponents.yaml`; if the article needs a new one, stop and ask the owner.
5. **Write each node** to `corpus/nodes/<id>.md`:

   ```markdown
   ---
   id: tawassul-001
   topic: tawassul
   type: claim-response
   opponent: [wahhabi]
   claim_en: '<exact sentence(s) from the article stating the objection>'
   claim_roman_urdu:
     - '<8–15 ways people actually type this objection: WhatsApp style, mixed English,'
     - ' common misspellings, with and without izafat/hyphens>'
   claim_source: { work: '...', author: '...', page: '...' } # only if the article names it; else omit
   their_evidence: [quran:39:3] # refs the article says the opponent cites
   short_answer: '<exact 1–3 sentences from the article, or empty>'
   response_source: { scholar: '...', work: '...', url: '...', page: '...' } # from article/meta.yaml only
   source_id: <source-id>
   dalail: [quran:5:35, hadith:h-0001]
   follow_ups: []
   madhhab: all
   lang: en
   status: draft
   ---

   ## Response

   <paragraph copied exactly from the article>

   <next paragraph copied exactly; you may append a chip such as [[quran:5:35]] after the
   article's own reference — chips are the only insertion allowed>
   ```

   Body paragraphs must appear in the same order as in the article; each paragraph must be one
   contiguous passage of `text.txt`. Do not add headings, bold, or lists that aren't in the source.

6. **Write each hadith** to `corpus/hadith/<id>.md` (frontmatter only):

   ```markdown
   ---
   id: h-0001
   text_ar: '<exact, if the article quotes the Arabic>'
   translation: '<exact translation as the article gives it>'
   reference: '<exact reference as the article writes it>'
   grading: '<exact, ONLY if the article states one>'
   cited_in: []
   source_id: <source-id>
   source: { scholar: '...', work: '...', url: '...' }
   status: draft
   ---
   ```

7. **Finish** (from `pipeline/`): `uv run python -m dalail_pipeline ingest-finish <source-id>`.
   It records `source_spans` (character offsets into `text.txt`), syncs `cited_in`, runs
   `check-verbatim` + `validate` + the eval leak check + the duplicate detector, and prints a table.
   - `NOT_VERBATIM`: your copy differs from the article. Re-copy it exactly; never "fix" the check.
   - `SPAN_MULTIPLE`: the text occurs more than once; fine unless the first occurrence is the wrong
     passage, in which case mention it in the summary.
   - Repeat until there are **0 errors**.
8. **Report** to the owner: paste the `ingest-finish` table, then list everything needing human
   input — empty `short_answer`s, empty `scholar`/`work`, claims you were unsure were objections,
   suggested alias merges, possible duplicates, follow-up links you were unsure about, and any part
   of the article you did not turn into a node and why. Do not commit unless the owner asks.
