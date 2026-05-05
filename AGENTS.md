

## Project docs
- docs/tasks.md: task list, milestones, and roadmap.
- docs/requirements.md: detailed requirements, referenced from tasks.
- docs/spec.md: project goal
- docs/prototype.html: current prototype single page html. Reference for the intended UI and interactions.


## Documentation maintenance
- When completing an item from docs/tasks.md, update its checkbox/status in the same change.
- When adding or changing local runtime state, document the fresh-checkout rebuild path in README.md or docs/; tracked files must be sufficient to recreate ignored state.
- When adding a direct dependency, add or update its one-line rationale in docs/dependencies.md.
- For foundational choices likely to be revisited, add a short ADR under docs/adrs/ using Context, Decision, Consequences.


## Tooling
- uses jujutsu / jj NOT git
- bun for JS tooling and server (but no runtime dependencies on Bun-specific APIs)
- SQLite for data storage

