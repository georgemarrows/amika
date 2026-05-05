# ADR 0001: Use SQLite As The Local Source Of Truth

## Status

Accepted.

## Context

Amika is a single-user, local-first Japanese learning workspace. It needs persistent data for imported dictionary records, user library state, texts, entity relationships, and later SRS state. The app should work offline and be rebuildable from tracked schema plus local import sources.

## Decision

Use SQLite as the project database. The local development database lives at `.var/amika.sqlite`, with media files under `.var/media/`. The `.var/` directory is runtime state and is ignored by version control. Schema changes are maintained through tracked SQL migrations.

## Consequences

Local state persists across app runs while remaining disposable and rebuildable. Future features should add migrations instead of editing the database manually. If `.var/amika.sqlite` is deleted, the expected recovery path is to run migrations and then rerun importers.
