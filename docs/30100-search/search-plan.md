# T-30100 Early Search Implementation Plan

## Summary

Implement the early Cmd-K search scope from `docs/30100/search-design.html`: fast local search over existing `kanji` and `words` tables only. Use explicit serial SQL queries, merge/rank in TypeScript, return one JSON response, and add a command-palette UI matching the prototype’s behavior.

No SQLite FTS, streaming, parallel queries, sentence search, exercises, migrations, or new dependencies.

## Key Changes

- Add shared search response types, e.g. `SearchResponse` and `SearchResultItem`, with:
  - `query`
  - `items`
  - item fields: `type: "kanji" | "word"`, `id`, `title`, `subtitle`, `targetPaneKey`
- Add `GET /api/search?q=...`.
  - Empty or whitespace-only query returns `200` with `items: []`.
  - Only allow `GET` and `HEAD`; other methods return `405`.
  - If the database cannot be opened/read, return `503` with the same style as existing API errors.
- Add repository search logic using serial bounded queries:
  - Exact kanji: `kanji.literal = q`.
  - Exact word: `words.expression = q`.
  - Word expression prefix: `words.expression like q || '%'`, excluding exact expression matches.
  - Reading prefix: `words.reading like q || '%'`.
  - English meaning contains: `words.primary_meaning like '%' || q || '%'`.
- Merge results in app code:
  - Rank order: exact kanji, exact word, expression prefix, reading prefix, English contains.
  - Dedupe by `type + id`, keeping the earliest/highest-ranked occurrence.
  - Limit each tier to 10 rows and cap final response at 30 items.
  - Sort expression prefix rows by `length(expression), expression`; sort reading/English rows by `expression`.
- Add client API helper `fetchSearchResults(query, signal?)`.
  - Use `encodeURIComponent`.
  - Throw on non-OK responses, matching existing API helpers.

## UI Behavior

- Add a `CommandPalette` component mounted from `PaneShell`.
- Open the palette from:
  - Sidebar Search button.
  - `Cmd+K` on macOS / `Ctrl+K` elsewhere.
- Keyboard behavior:
  - `Esc` closes the palette when open.
  - If palette is closed, existing `Esc` behavior still closes the rightmost pane.
  - Arrow up/down moves the active result.
  - `Enter` opens the active result.
- Search behavior:
  - Debounce input by 80ms.
  - Ignore stale responses using `AbortController` or a monotonically increasing request id.
  - Show a small loading/status state while a non-empty query is pending.
  - Show “No results” only after the latest request completes with no items.
- Opening a result:
  - `kanji` result opens `kanji:${literal}`.
  - `word` result opens `word:${id}`.
  - Use `paneState.openFromRoot(...)` so global search jumps directly to the selected entity.
- Styling:
  - Follow `docs/30100/search-prototype.html`.
  - Use existing CSS custom properties.
  - Keep the palette fixed, centered, boxed, and keyboard-readable.
  - Do not add decorative assets.

## Tests

- Add repository tests for:
  - Query `勉` returns exact kanji before word prefix matches.
  - Query `勉強` returns exact word before longer prefix matches.
  - Query `べん` finds words by reading prefix.
  - Query `study` finds words by English meaning.
  - Dedupe keeps only one item when a word matches multiple tiers.
  - Empty query returns no items.
- Add server tests for:
  - `GET /api/search?q=...` response shape and ranking.
  - Missing/empty query returns `items: []`.
  - Unsupported method returns `405`.
- Add client/unit tests for:
  - Search API helper builds the expected URL and handles failures if the existing test setup supports fetch mocking.
  - Pane state accepts search result target pane keys already covered by `kanji:*` and `word:*`.
- Add UI tests if existing client test patterns make this practical:
  - Cmd/Ctrl-K opens palette.
  - Typing triggers results.
  - Arrow/Enter opens the selected pane.
  - Esc closes the palette before closing panes.
- Run:
  - `bun run test:client`
  - `bun run test:server`
  - `bun run test:db`
  - `bun run typecheck`

## Documentation And Completion

- Keep `docs/30100/search-design.html` and `search-prototype.html` as design/prototype references; do not replace them with implementation details.
- When implementation is complete and verified, update `docs/tasks.md` to mark `T-30100 Search` as done.
- No README, dependency, migration, or ADR update is needed unless the implementation introduces new runtime state, dependencies, schema, or a revisitable foundational decision.

## Assumptions

- Early search scope is exactly kanji + words from existing tables.
- Search opens results as global navigation with `openFromRoot`, not as a pane to the right of the current pane.
- One JSON response is the accepted transport; no JSONL, SSE, WebSocket, or partial streaming.
- SQLite `LIKE` behavior is sufficient for this first scope; FTS5 and fuzzy sentence search are deferred.
