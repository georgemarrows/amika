# Client-side code review — 2026-05-10

Scope: client-side code only. I used `docs/spec.md`, `docs/requirements.md`, `docs/tasks.md`, `docs/bugs.md`, and shared API contracts for context, but findings below target `client/src` behavior and maintainability.

Priority key:
- **P1**: likely to confuse users, block an expected current workflow, or create near-term implementation drag.
- **P2**: real issue, but either lower blast radius or partially explained by deferred roadmap work.
- **P3**: cleanup or risk worth tracking before the surface area grows.

## Verification and coverage

Commands run:
- `bun run test:client:coverage` — 17 passed, 0 failed.
- `bun run typecheck` — passed.
- `bun run build:client` — passed.

I added `test:client:coverage` to `package.json`:

```json
"test:client:coverage": "bun test --coverage ./client/src/**/*.test.ts"
```

Coverage output:

| File | % Funcs | % Lines | Notes |
| --- | ---: | ---: | --- |
| All reported files | 97.50 | 94.25 | Only modules imported by unit tests are counted. |
| `client/src/models/home-view-model.ts` | 100.00 | 100.00 | View-model only. |
| `client/src/models/kanji-detail-view-model.ts` | 100.00 | 100.00 | View-model only. |
| `client/src/models/word-detail-view-model.ts` | 100.00 | 100.00 | View-model only. |
| `client/src/state/pane-state.ts` | 87.50 | 71.23 | `describePane` lines 72-92 are uncovered. |
| `shared/home-data.ts` | 100.00 | 100.00 | Shared seed data helper. |

The headline coverage is misleadingly high. It excludes the UI components, API fetch wrapper, DOM animation helper, and CSS/layout behavior because the current client tests import only view models and pane-state helpers. There is no component-level coverage for `App`, `PaneShell`, `PaneBody`, `HomePane`, `KanjiPane`, `WordPane`, `KanjiListPane`, `WordListPane`, or `ReviewPane`.

## Likely bugs

- **P2: Clickable table rows are mouse-only.** 

  VALID - moved to tasks.md

  `client/src/components/KanjiListPane.tsx:31-39` and `client/src/components/WordListPane.tsx:31-39` attach `onClick` to `<tr>`. Those rows are not keyboard-focusable, do not expose button/link semantics, and do not handle Enter/Space. The rest of the UI generally uses `<button>`, so these lists are a regression for keyboard access.

- **P2: Top-level app loading depends entirely on `/api/home`.** 

  VALID - will be cleaned up later

  `client/src/App.tsx:7-31` gates the whole pane shell on `fetchHomePageData()`. If `/api/home` fails while list/detail endpoints would still work, the user cannot open Words/Kanji at all. Since the sidebar and list panes now have their own endpoint fetches, the shell should probably render with localized home/review failure states instead of blocking the whole client.


## Questionable implementation details

- **P2: Middle-pane close can leave orphaned panes to the right.** 

  POSSIBLE - review later

  `closePane` filters only the selected pane in `client/src/state/pane-state.ts:116-124`. In a trail like `home -> kanji -> word`, closing the kanji pane leaves `home -> word`. That may be acceptable, but it weakens the “horizontal reasoning trail” model in `docs/spec.md`. If descendants are context-dependent later, close should probably trim rightward from the closed pane.

- **P2: Detail/list panes refetch every time they are remounted.** 

  POSSIBLE - review later

  `createResource` is local to each pane in `KanjiPane.tsx:12`, `WordPane.tsx:8`, `KanjiListPane.tsx:7`, and `WordListPane.tsx:7`. Root navigation and pane closing/remounting can repeat requests for stable local data. This is fine at current scale, but a small client-side resource cache or shared query helper will become useful once search and SRS edits need consistency.

- **P3: Global Escape handling has no focus or future overlay guard.** 

  POSSIBLE - review later

  `client/src/components/PaneShell.tsx:13-21` closes the rightmost pane for every Escape keydown. That satisfies R-UX-004 today, but command palette, lookup popups, and future editors also need Escape. This handler should eventually ignore text entry/composition contexts and yield to active overlays.

- **P3: API errors lose useful response context.** 

  POSSIBLE - review later

  `client/src/api.ts:6-54` throws only endpoint/status-specific messages and discards response bodies. That keeps the wrapper small, but client error states cannot distinguish not-found, migration-needed, server-down, or bad payload cases except by the generic copy in each pane.

## Hard to maintain code

- **P1: Pane routing is encoded as string conventions across several files.** 

  FIX THIS

  `PaneKey` patterns live in `client/src/state/pane-state.ts:5-11`, parsing happens in `client/src/components/PaneBody.tsx:26-42`, descriptions in `pane-state.ts:72-94`, and route creation is scattered through component click handlers. This is still manageable with two entity types, but search, grammar, texts, compare panes, and SRS cards will multiply string slicing and `startsWith` checks. A small pane descriptor/router module would keep parsing, labels, and target construction together.

- **P1: Test coverage does not exercise rendered UI behavior.** 
 
  POSSIBLE - review later

  Existing tests cover pure view-model formatting and pane-state helpers, but none of the user-facing bugs above would be caught. The next useful coverage step is a Solid component test layer for Home navigation, list row keyboard behavior, inert/disabled controls, and App error/loading branches.

- **P2: `HomePage.tsx` appears to be dead pre-pane UI.** 

  FIX THIS

  `client/src/HomePage.tsx` is not imported by the active app. It duplicates sidebar/home layout concepts using older markup and link behavior. Keeping it around makes it harder to tell which home implementation is canonical.

- **P2: CSS is a single global stylesheet.** 

  POSSIBLE - review later

  `client/src/styles.css` is well-organized and uses custom properties, but it already spans app shell, panes, cards, lists, details, review, and responsive behavior. As features land, global class names like `.hero`, `.section`, `.meta`, `.title`, and `.big` will become collision-prone. Component-scoped naming or at least sectioned naming conventions would reduce accidental cross-feature styling.

- **P3: Placeholder strings are embedded in components and view models.** 

  POSSIBLE - review later

  Examples include `Unknown`, “No words imported…”, “Next details”, and migration/import guidance across `KanjiPane`, `WordPane`, and view models. Centralizing common empty/error labels would keep tone and behavior consistent as more entity types are added.
