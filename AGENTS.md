

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
- Developers typically keep `bun run dev` running on ports 3000/5173; leave that stack untouched and use `bun run dev:agent` for agent-run verification (defaults to API 3300 and client 5174).
- Run code that imports `better-sqlite3` with Node/tsx, not `bun`; Bun cannot load this native module in this project.
- Run migrations at process startup or explicit setup boundaries; do not add runtime fallbacks for missing migrated tables.


## Data modeling
- When suggesting table schemas or table states, include primary key and foreign key information.


## CSS
- Use CSS custom properties for repeated colors, spacing, dimensions, borders, and radii. Prefer using these custom properties, even for one-off values, to keep the visual language consistent and refactorable.


## Client state
- Prefer specialized state helper factories over exported singleton signals for shared UI state.


## Solid components
- Prefer extracting large JSX blocks into small, named local components instead of keeping dense markup inline in the pane component.
- Pass typed callback props that describe UI intent, such as `openPane`, rather than threading broader app state through child components.
- Prefer structured view-model data over preformatted strings when repeated UI fragments need consistent rendering.
- Reuse small presentation components.
- Keep feature-specific helper components local to the component file until they are reused elsewhere.
- Prefer Switch/Match to the assymmetry of Show with fallback.
