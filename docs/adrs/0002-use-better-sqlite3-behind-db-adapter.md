# ADR 0002: Use better-sqlite3 Behind A DB Adapter

## Status

Accepted.

## Context

The app needs a reliable SQLite driver for server code, migrations, tests, and import scripts. The project uses Bun for tooling, but the codebase should avoid Bun-specific runtime APIs so it remains portable to standard Node execution.

## Decision

Use `better-sqlite3` for SQLite access and isolate direct driver usage under `server/src/db`. Application and importer code should use the DB adapter, migration runner, and repository helpers rather than importing `better-sqlite3` directly. DB/import scripts and DB tests run under Node via `node --import tsx` because Bun does not currently support loading `better-sqlite3` in this project.

## Consequences

SQLite access is synchronous, mature, and easy to use transactionally for local-first workflows. Driver coupling stays contained, making it easier to change the database access layer later if needed. Commands remain reachable through `bun run`, but the underlying DB process is Node.
