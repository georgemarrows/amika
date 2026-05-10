# Miscellaneous codebase review — 2026-05-10

Scope: everything not already covered by the client review or the server/importer review: data model shape, shared API contracts, npm/Bun scripts, TypeScript/Vite config, README/docs consistency, and repo hygiene.

Priority key:
- **P1**: likely data loss/correctness issue, misleading project contract, or near-term architectural drag.
- **P2**: real issue with lower immediate blast radius.
- **P3**: cleanup worth tracking before the project grows.

## Verification

Commands run:
- `bun run test` — 51 passed, 0 failed across the default fast suite.
- Previous review pass also ran `bun run typecheck`, `bun run test:client:coverage`, `bun run test:server-importer:coverage`, and `bun run test:soak`.

I did not add another script for this pass.

## Likely Bugs

- **P1: The word tables dropped source provenance that the design calls for.** `docs/T1010_detailed_design.md:245-250` includes `words.source_record_id`, and `:272-276` includes `word_meanings.source_record_id`. The actual migration omits both in `server/src/db/migrations/002_words.sql:1-28`. That makes it much harder to reconcile or rebuild derived word rows from raw source records when parser rules change.

- **P1: Shared kanji detail contract hard-codes future sections as impossible.** `shared/kanji-detail.ts:24-28` types `components`, `mnemonics`, and `relations` as empty tuple types (`[]`). That matches today’s response, but it means the shared contract actively prevents non-empty data for already-planned tasks T-1010c/d/f. These should be typed as arrays of provisional item shapes before those features land.

- **P2: README verification output is inconsistent with the commands it shows.** `README.md:64-68` runs three SQLite queries, including a readings query and all words, but the “Expected output” block at `README.md:70-78` omits the `GU` reading row and only shows the four `具` words. After a full import, `select expression... from words order by rowid` will output far more than those four rows.

- **P2: Source-deck idempotency is implemented by convention, not constrained by the schema.** The design says imports should be idempotent by file hash (`docs/T1010_detailed_design.md:353`), but `source_decks` only has `id` as primary key and no unique index on `file_hash` in `server/src/db/migrations/001_initial_kanji.sql:1-8`. If deck-id generation changes or another importer uses a different ID for the same file, the DB can represent one source file as multiple decks.

- **P2: Relationship tables do not specify cascade behavior.** `word_meanings.word_id` and `word_kanji.word_id` reference `words(id)` in `server/src/db/migrations/002_words.sql:20-37`, but there is no `on delete cascade`. The repair script has to manually delete children first. Future word deletion or import reconciliation will either fail FK checks or need every caller to remember child table order.

## Questionable Implementation Details

- **P1: The current schema still cannot represent the core app graph.** This is partly intentional, but it is worth naming: requirements include texts, grammar, SRS, user overrides, appears-in backlinks, and stable IDs for renamed/alternate forms (`docs/requirements.md:7-13`, `:54-59`, `:102-111`). The current DB only covers source decks, source records, media, kanji, readings, words, meanings, and word-kanji links. Before ingestion or SRS work starts, the next ADR/migration should decide where dictionary truth ends and user-owned learning state begins.

- **P2: The “projection” status of `words` is documented but not visible in the schema.** ADR 0004 explicitly says the early `words`, `word_meanings`, and `word_kanji` tables are a projection (`docs/adrs/0004-PROVISIONAL-generic-word-dictionary-model.md:150-160`). The database itself has no naming or metadata that marks them as imported dictionary projections rather than user library words. That distinction will matter for lookup, custom meanings, SRS, and deletion.

- **P2: Runtime versions are not pinned or declared.** `package.json` has no `packageManager` field or `engines` block, while the project depends on Bun commands, Node’s native test coverage flag, `tsx`, and native `better-sqlite3`. The local run used Bun 1.3.13 and Node 24.15.0; a fresh checkout on a different Node/Bun pair can fail in ways that look like project bugs.

- **P2: The build output path leaks the source layout.** `server/tsconfig.json:7-8` sets `outDir` to `../dist/server` and `rootDir` to `..`, which produces the start path used in `package.json:15`: `dist/server/server/src/index.js`. It works, but it is brittle and surprising. A dedicated server build root would make `start` less dependent on the current folder layout.

- **P2: The default `test` script omits typecheck and coverage.** `package.json:16-23` has separate `test`, coverage, soak, and typecheck scripts. That is fine for speed, but default green tests can miss TypeScript failures and coverage regressions unless contributors remember the separate commands.

- **P3: Script names are drifting from what they run.** `test:db` in `package.json:21` runs DB tests plus all `scripts/*.test.ts`, including importer, repair, and backup tests. That is not wrong, but the name understates the surface area.

- **P3: Vite/client port configuration is not validated.** `vite.config.ts:4-6` converts environment values with `Number(...)` and passes them through. Bad `CLIENT_PORT`, `HOST`, or `PORT` values will fail later inside Vite/proxy setup rather than at a clear project-level validation point.

## Hard to Maintain Code / Docs

- **P1: Roadmap status is internally inconsistent around readings.** `docs/tasks.md:12-13` marks T-30000a/b as done for loading kanji readings, while `docs/tasks.md:69` still lists T-1010c “Readings + mnemonics” as unchecked. The actual schema has `kanji_readings` in `server/src/db/migrations/003_kanji_readings.sql`. This makes it unclear whether future work should add only mnemonics or revisit readings too.

- **P2: README still describes the project as a minimal T-1000 scaffold.** `README.md:3-7` says “Minimal T-1000 scaffold” and “Shared mock home-page data,” but the repo now has real SQLite migrations, Kanji Damage import, readings, words, media, repair, and coverage scripts. The rebuild section is useful; the opening summary is stale.

- **P2: `scripts/dev.ts` exits without waiting for child shutdown.** On SIGINT/SIGTERM it signals children and immediately exits (`scripts/dev.ts:25-41`); when a child exits, it sends SIGTERM to the other child and exits (`:43-51`). That usually works, but it can leave cleanup races or orphaned output if either child needs a moment to close.

- **P2: The shared home-data contract mixes UI mock data with domain-looking data.** `shared/home-data.ts:1-20` exposes review counts, latest source, recent additions, and exploration cards, but none of those have stable IDs or entity targets. That already created client routing issues, and it will become harder to unwind if other code starts treating this shape as real domain data.

- **P3: Repo hygiene has ignored local artifacts present in the workspace.** `.gitignore:1-5` correctly ignores `node_modules`, `dist`, `.var`, `.DS_Store`, and `*.apkg`, and those artifacts exist locally. That is fine, but the root `.DS_Store` and large APKG/runtime state can still interfere with ad hoc file scans and disk usage if tooling forgets to exclude ignored files.

- **P3: Documentation does not mention the new coverage commands.** `README.md:86` documents `bun run test` and `bun run test:soak`, but not `bun run test:client:coverage` or `bun run test:server-importer:coverage`. The commands are useful enough to include in the Commands or testing section.
