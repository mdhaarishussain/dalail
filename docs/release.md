# Release

## TODO before any Play Store upload

- [ ] **Confirm the final Android package id.** Currently the placeholder `org.dalail.app`
      (`apps/mobile/app.json` → `android.package`, `ios.bundleIdentifier`). It cannot change after
      the first upload.
- [ ] **Confirm the app name** in English and Roman Urdu. Currently the placeholder "Dalail" in both.
- [ ] Release signing key: generate, back up (two offline copies), document recovery here.

## Size budget

Google Play limits for Android App Bundles (compressed download size), checked 2026-11-03 on
[Play Console Help — maximum size limits](https://support.google.com/googleplay/android-developer/answer/9859372):

| Limit                                               | Value                                                          |
| --------------------------------------------------- | -------------------------------------------------------------- |
| Base module                                         | 500 MB                                                         |
| Each feature module                                 | 500 MB                                                         |
| Each asset pack                                     | 1.5 GB                                                         |
| All install-time modules + install-time asset packs | 4 GB                                                           |
| Soft warning                                        | apps over 200 MB show a non-blocking "use mobile data?" dialog |

**Our target (owner decision, 2026-11-03):** stay under the 500 MB base-module limit; aim to stay
under 200 MB so users on mobile data (most of our users) don't see the warning dialog. Current
estimate with the e5 embedding model bundled: ~160 MB (app ~30 MB + e5 GGUF 126 MiB + DB).
Re-check this page before each release; the limits have changed before.

**Fallback if we approach the limit:** move the e5 GGUF (and, if needed, `dalail.db`) into a
Play Asset Delivery **install-time** asset pack. Install-time packs are delivered with the app
install, so there is still no runtime download (non-negotiable 5). Fast-follow and on-demand packs
are **not** used, because they download after install.

The optional LLM (~2.5 GB) is never bundled; it is the single user-started download.

Phase 6 completes this document (signing, R8, store listing, Data Safety, internal track).
