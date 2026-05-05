# ADR 0003: Import Dictionary Data Via CLI, Not REST

## Status

Accepted.

## Context

Kanji Damage APKG import is an operational data-loading task, not a user-facing workflow. The importer needs filesystem access, repeatable execution, parser tests, source provenance, and media extraction before the UI has any reason to expose import controls.

## Decision

Implement dictionary ingestion as CLI scripts. The T-1010a importer reads a local APKG file, runs migrations, stores source provenance, imports the exact `具` kanji record, and copies stroke-order media into `.var/media/kanji-damage/`. Do not add REST upload/import endpoints yet.

## Consequences

Imports stay easy to run, test, and repeat locally without expanding the HTTP API surface. Future UI work can consume normalized database data first. If dictionary import becomes a user-facing feature later, it should be designed from the proven CLI behavior rather than added prematurely.
