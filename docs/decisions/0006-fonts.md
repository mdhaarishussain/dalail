# 0006 — Fonts for Arabic and Urdu

- Status: Accepted
- Date: 2026-11-04

| Use                                                | Font                                    | Licence     | Source                              |
| -------------------------------------------------- | --------------------------------------- | ----------- | ----------------------------------- |
| Quran and hadith Arabic text                       | **Amiri** Regular + Bold                | SIL OFL 1.1 | google/fonts `ofl/amiri`            |
| Urdu: Kanz ul Iman translation, Urdu-script bodies | **Noto Nastaliq Urdu** (variable, wght) | SIL OFL 1.1 | google/fonts `ofl/notonastaliqurdu` |

- Files and their OFL texts are in `apps/mobile/assets/fonts/`, embedded at build time with the
  `expo-font` config plugin (no runtime download). The Licences screen shows the full OFL texts.
- Both fonts contain ﷺ (U+FDFA) and the Urdu-specific letters (checked with fontTools).
- Nastaliq is what Urdu readers expect; it needs a tall line height (2.3×) to avoid clipping.
  If rendering problems show up on some Android versions, the fallback is Noto Naskh Arabic (OFL).
- Arabic and Urdu text is right-to-left (`writingDirection: 'rtl'`, right-aligned) and larger
  than body text. Text is always shown exactly as stored.
