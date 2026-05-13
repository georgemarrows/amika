# Dependencies

This lists direct project dependencies and why they are present. Keep entries to one line so dependency growth stays easy to review.

## Runtime

- `better-sqlite3`: Node SQLite driver for local persistent storage.
- `jszip`: Reads APKG files as zip archives for dictionary import.
- `solid-js`: Client UI framework for the pane-based Japanese learning workspace.
- `hono`: Lightweight TypeScript HTTP server framework for the API backend.

## Development

- `@types/better-sqlite3`: TypeScript declarations for `better-sqlite3`.
- `@types/node`: TypeScript declarations for Node APIs used by the server, scripts, and tests.
- `bun-types`: TypeScript declarations for Bun commands and Bun test files.
- `tsx`: Runs TypeScript DB/import scripts and DB tests under Node. `better-sqlite3` doesn't work in Bun.
- `typescript`: Static type checking and server compilation.
- `vite`: Client dev server and production bundler.
- `vite-plugin-solid`: Solid JSX transform integration for Vite.
