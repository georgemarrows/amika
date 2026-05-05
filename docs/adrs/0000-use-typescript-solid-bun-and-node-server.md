# ADR 0000: Use TypeScript, Solid, Bun Tooling, And A Small Node-Compatible Server

## Status

Accepted.

## Context

Amika needs to move beyond the single-file prototype into a maintainable local-first app. The first implementation needs a real frontend, shared types, a small local HTTP server, and tooling that stays lightweight while the product shape is still evolving.

## Decision

Use TypeScript across the client, server, shared code, and scripts. Use Solid for the client UI. Use Bun for package management, common project commands, the dev workflow, and Bun-compatible tests. Keep the server and operational scripts Node-compatible rather than relying on Bun-specific runtime APIs.

## Consequences

The app gets a fast TypeScript/Solid development loop without committing core runtime code to Bun-only APIs. Some native Node modules, especially `better-sqlite3`, must run under Node; project commands can still expose that through `bun run`.
