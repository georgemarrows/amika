# Server and importer code review — 2026-05-10

Scope: server-side code under `server/src`, importer/repair/backup scripts under `scripts`, and their shared contracts/tests. I used `docs/spec.md`, `docs/requirements.md`, `docs/tasks.md`, `docs/T1010_detailed_design.md`, and ADRs for context.

The Kanji Damage importer is intentionally parsing somewhat structured source HTML. I have not treated “uses regexes over HTML” as a finding by itself; the findings below are about correctness boundaries, stale state, test gaps, and maintenance pressure around that unavoidable mess.

Priority key:
- **P1**: likely data correctness issue, current workflow blocker, or near-term architectural drag.
- **P2**: real issue with lower blast radius or reasonable current workaround.
- **P3**: cleanup or risk worth tracking before the system grows.

## Verification and coverage

Commands run:
- `bun run test:server-importer:coverage` — 34 passed, 0 failed.
- `bun run test:soak` — 1 passed, 0 failed; full-deck import idempotency test ran because the local APKG is present.
- `bun run typecheck` — passed.

I added `test:server-importer:coverage` to `package.json`:

```json
"test:server-importer:coverage": "node --import tsx --test --experimental-test-coverage ./server/src/app.test.ts ./server/src/db/*.test.ts ./scripts/*.test.ts"
```

Coverage output:

| File | Line % | Branch % | Funcs % | Notes |
| --- | ---: | ---: | ---: | --- |
| All reported files | 91.92 | 71.92 | 93.96 | Fast server/importer suite, not soak. |
| `scripts/import-kanji-damage.ts` | 89.77 | 67.13 | 93.06 | Parser and `具` integration covered; many failure paths uncovered. |
| `scripts/repair-kanji-damage-import.ts` | 83.62 | 86.67 | 80.00 | Happy dry-run/apply path covered. |
| `scripts/sqlite-backup.ts` | 91.67 | 69.23 | 100.00 | Backup success/missing-db paths covered. |
| `server/src/app.ts` | 82.24 | 64.29 | 92.00 | Main API paths covered; static, HEAD, DB-unavailable, and media failure branches thin. |
| `server/src/db/connection.ts` | 100.00 | 90.00 | 100.00 | Good unit coverage. |
| `server/src/db/migrations.ts` | 100.00 | 100.00 | 100.00 | Good unit coverage. |
| `server/src/db/repositories.ts` | 100.00 | 86.11 | 100.00 | Good unit coverage. |

## Likely bugs

- **P1: “All kanji” and “All words” endpoints silently return only 50 rows.** `server/src/app.ts:26` hard-codes `libraryListLimit = 50`, and `toKanjiListResponse` / `toWordListResponse` pass it through at `server/src/app.ts:164-173`. After a full Kanji Damage import, the soak test expects 1,629 kanji, but `/api/kanji` returns only the first 50 with no pagination metadata or query control. The client labels those panes as “All kanji” / “All words,” so this is user-visible truncation.

- **P1: Full imports are not atomic.** `importKanjiDamage` backs up, opens the app DB, upserts the source deck, then imports each note in its own transaction at `scripts/import-kanji-damage.ts:693-757`. If note N fails, notes 1..N-1 and any already-copied media remain in the target DB/filesystem. `docs/T1010_detailed_design.md:340-353` calls for a transaction or staging behavior for the import. Per-note transactions are useful, but the full-deck operation can still leave a mixed old/new import.

- **P1: Re-importing does not remove words or meanings that disappear from the parser output.** Readings and word-kanji links are replaced (`replaceKanjiReadings` at `server/src/db/repositories.ts:342-384`, `replaceWordKanji` at `:328-340`), but `importWordRecord` only upserts words and meanings at `scripts/import-kanji-damage.ts:592-633`. If a parser fix later rejects a previously imported word or changes meanings, old `words` / `word_meanings` rows can remain. The repair script exists because this already happened for invalid words.

- **P2: Media files can be orphaned when DB import fails.** `importMediaAsset` writes the media file before the per-note DB transaction at `scripts/import-kanji-damage.ts:531-554`, and the note import transaction starts later at `:732`. A DB failure after the file write leaves a file under `.var/media` that no DB row necessarily references.

- **P2: `words(expression, reading)` does not enforce uniqueness when `reading` is null.** The migration creates `idx_words_identity` at `server/src/db/migrations/002_words.sql:11-12`, but SQLite treats `NULL` values as distinct in unique indexes. The current importer usually builds deterministic IDs, so this is not exploding today, but future dictionary sources or manual inserts can create duplicate expression/null-reading rows.

- **P2: Server-side list endpoints have no way to request more data or know they are truncated.** This is separate from the “All” labeling bug: `listKanji` and `listWords` accept a limit (`server/src/db/repositories.ts:442-460`, `:565-580`), but the HTTP API exposes neither `limit`, `offset`, cursor, total count, nor `hasMore`. Search and library browsing will hit this immediately.

## Questionable implementation details

- **P1: Imported media paths are stored relative to the process cwd.** `importMediaAsset` stores `relative(process.cwd(), absoluteStoragePath)` at `scripts/import-kanji-damage.ts:535-553`; `serveMedia` later resolves it with `resolve(media.storagePath)` at `server/src/app.ts:176-184`. This works only if the server is started from the same project root used during import. Storing app-relative paths explicitly or absolute paths under a configured media root would make serving independent of cwd.

- **P2: API handlers swallow DB errors and return generic 503s.** `serveKanji`, `serveKanjiList`, `serveWordList`, `serveWord`, and `serveMedia` catch broad exceptions and return “database unavailable” without logging or structured error detail (`server/src/app.ts:201-353`). That is friendly to the client but weak for local debugging, especially during migration/import failures.

- **P2: `upsertWord` conflicts only on `id`, not the declared word identity.** `server/src/db/repositories.ts:288-315` handles `on conflict(id)`, while the schema also declares a unique identity on `(expression, reading)`. If another source generates a different stable ID for the same expression/reading, the import will error instead of reconciling the generic word entity.

- **P2: Migration tracking has no checksum or dirty-state detection.** `runMigrations` records only file names in `schema_migrations` (`server/src/db/migrations.ts:36-58`). That is acceptable early, but if a migration file is edited after being applied locally, the runner will not notice schema drift.

- **P2: The HTTP bridge buffers every response body into memory.** `server/src/http.ts:25-26` converts the full `Response` body to a `Buffer` before ending the Node response. Current JSON and stroke images are small, but this pattern will be a poor fit for larger static assets or future media/ingestion endpoints.

- **P3: Static asset and migration paths depend on `process.cwd()`.** `clientDistDir` in `server/src/app.ts:24`, `defaultMediaRoot` at `:25`, `defaultDatabasePath` in `server/src/db/connection.ts:15`, and `defaultMigrationsDir` in `server/src/db/migrations.ts:10` all assume commands are launched from the repo root. The documented scripts do that today, but production-style execution is fragile if cwd changes.

- **P3: Parser entity decoding is intentionally narrow.** `decodeHtmlEntities` handles a small named subset at `scripts/import-kanji-damage.ts:193-204`. That is probably enough for current tests, but numeric entities and less common named entities will remain encoded or be parsed incorrectly. This is a good place for fixture-driven hardening rather than introducing a large parser dependency prematurely.

## Hard to maintain code

- **P1: Import cleanup is split between importer behavior and one-off repair logic.** The importer’s admissibility rule is `isImportableWordExpression` at `scripts/import-kanji-damage.ts:368-370`; the repair script reuses it to delete bad prior imports at `scripts/repair-kanji-damage-import.ts:75-103`. That was a pragmatic recovery, but as parser rules change, cleanup should become part of repeatable import reconciliation rather than a separate manual script per bug class.

- **P1: Parser coverage is good on hand-picked rows but thin on full-deck invariants.** The fast tests cover several known tricky rows, and the soak test verifies broad counts/idempotency. They do not assert samples for notes without readings, notes without words, duplicate word identities, changed parser output on re-import, or a corpus of representative raw rows. A small fixture set extracted from real APKG notes would catch regressions without running the full soak every time.

- **P2: Import orchestration mixes extraction, media copying, parsing, DB upserts, stats, backup, and CLI concerns.** `scripts/import-kanji-damage.ts` is doing real work across roughly 870 lines. The parser functions are reasonably isolated, but `importKanjiDamage` itself (`:659-797`) still coordinates too many responsibilities. A split into `apkg-reader`, `kanji-damage-parser`, and `import-writer` modules would make transactional/reconciliation fixes easier.

- **P2: Repository mapping is repetitive and stringly typed.** `server/src/db/repositories.ts` manually maps SQL snake_case rows to camelCase objects throughout (`getKanjiByLiteral`, `listKanji`, `getWordsForKanji`, `listWords`, `getWordById`, `getMediaAssetById`). It is readable now, but adding components, mnemonics, relations, SRS, and texts will multiply this pattern. A lightweight row mapper or query helper would reduce copy/paste risk without hiding SQL.

- **P2: The server route table is hand-rolled in a single function.** `createApp` branches manually over every route at `server/src/app.ts:355-427`. That is fine for the current API count, but adding search, SRS, ingestion, and export will make method handling, route segment decoding, and error behavior drift unless route registration is centralized.

- **P3: Coverage does not include `server/src/http.ts` or `server/src/index.ts`.** The app-level tests call `createApp` directly, so the Node HTTP adapter and process startup/shutdown behavior are uncovered. That is acceptable for now, but one adapter test for HEAD behavior, response headers, and error fallback would close a meaningful gap.

- **P3: Optional soak coverage is pass/fail only.** `bun run test:soak` is useful and passed, but it does not feed coverage and only checks aggregate counts. Keeping a short checked-in summary fixture or snapshot of selected imported entities would make future parser changes easier to review.
