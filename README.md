# Amika

Minimal `T-1000` scaffold:

- Solid + TypeScript client in [`client`](./client)
- Small TypeScript HTTP server in [`server`](./server)
- Shared mock home-page data in [`shared`](./shared)

## Commands

- `bun install`
- `bun run dev`
- `bun run db:migrate`
- `bun run import:kanji-damage -- Official_KanjiDamage_deck_REORDERED.apkg --literal 具`
- `bun run build`
- `bun run test`

## Rebuild Local Database State

The project uses a local SQLite database at `.var/amika.sqlite`. The `.var/` directory is runtime state and is intentionally ignored by version control.

To rebuild the current T-1010a state from a fresh checkout:

1. Install dependencies:

   ```sh
   bun install
   ```

2. Apply schema migrations:

   ```sh
   bun run db:migrate
   ```

3. Put `Official_KanjiDamage_deck_REORDERED.apkg` in the repo root. APKG files are ignored by version control, so this file must be supplied locally.

4. Import the current one-kanji fixture:

   ```sh
   bun run import:kanji-damage -- Official_KanjiDamage_deck_REORDERED.apkg --literal 具
   ```

This creates:

- `.var/amika.sqlite`
- `.var/media/kanji-damage/<hash>.png`

The importer currently loads the Kanji Damage note for `具`, its source provenance, minimal kanji metadata, and its stroke-order image. Future T-1010 tasks will extend the schema and importer for readings, mnemonics, components, words, and relations.

To verify the current imported row:

```sh
sqlite3 .var/amika.sqlite "select literal, primary_meaning, stroke_count, frequency_rank, usefulness from kanji where literal = '具';"
```

Expected output:

```text
具|tool|8|683|★★★★☆
```

The DB/import scripts run through Node with `tsx` because `better-sqlite3` is a native Node module. The project still uses `bun` for package management and the main command entrypoints.

## Project Docs

- [Tasks and roadmap](./docs/tasks.md)
- [Requirements](./docs/requirements.md)
- [Design spec](./docs/spec.md)
- [Dependency rationale](./docs/dependencies.md)
- [Architecture decision records](./docs/adrs)

## Browser

For local development, open [http://127.0.0.1:5173](http://127.0.0.1:5173) after `bun run dev`.

For the production-style build, run `bun run build`, then `bun run start`, then open [http://127.0.0.1:3000](http://127.0.0.1:3000).
