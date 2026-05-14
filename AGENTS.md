

## Project docs
- docs/tasks.md: task list, milestones, and roadmap.
- docs/requirements.md: detailed requirements, referenced from tasks.
- docs/spec.md: project goal
- docs/prototype.html: current prototype single page html. Reference for the intended UI and interactions.


## Documentation maintenance
- When completing an item from docs/tasks.md, update its checkbox/status in the same change.
- For exploratory design docs, clearly separate immediate implementation scope from future ideas.
- For HTML design docs, prefer simple boxed sections and editable styling; use docs/30100/search-design.html as a reference.
- When adding or changing local runtime state, document the fresh-checkout rebuild path in README.md or docs/; tracked files must be sufficient to recreate ignored state.
- When adding a direct dependency, add or update its one-line rationale in docs/dependencies.md.
- For foundational choices likely to be revisited, add a short ADR under docs/adrs/ using Context, Decision, Consequences.


## Tooling
- uses jujutsu / jj NOT git
- bun for JS tooling and server (but no runtime dependencies on Bun-specific APIs)
- George typically keeps the dev server running on the standard port; check/reuse it before starting another server.
- Run code that imports `better-sqlite3` with Node/tsx, not `bun`; Bun cannot load this native module in this project.


## Data modeling
- When suggesting table schemas or table states, include primary key and foreign key information.


## CSS
- Use CSS custom properties for repeated colors, spacing, dimensions, borders, and radii. Prefer using these custom properties, even for one-off values, to keep the visual language consistent and refactorable.


## Client state
- Prefer specialized state helper factories over exported singleton signals for shared UI state.
