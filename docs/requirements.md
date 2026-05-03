# Requirements

One line per requirement. Each is a testable statement. Namespaces: `DATA` (model), `UX` (navigation/layout), `LOOK` (selection lookup), `SRS` (review), `ING` (ingestion), `CMP` (confusables), `DICT` (dictionary infra), `PERS` (persistence).

## Data model

- **R-DATA-001** A Word has reading, meaning, component kanji, and a list of Texts it appears in.
- **R-DATA-002** A Kanji has reading, meaning, components, stroke count, on/kun readings, and mnemonics.
- **R-DATA-003** A Grammar point has pattern, meaning, source, topic, and example sentences.
- **R-DATA-004** A Text has source type (lesson | podcast | book), title, source name, and content as ordered JP/EN line pairs.
- **R-DATA-005** Any Word, Kanji, or Grammar point can be in the SRS queue.
- **R-DATA-006** All entity relations are bidirectional and navigable from either end.
- **R-DATA-007** Entities have a stable id independent of their display form (so renames and alt spellings don't break links).

## Navigation & layout

- **R-UX-001** The app has a left sidebar, a main pane area, and a floating command palette.
- **R-UX-002** Clicking an entity link opens a new pane to the right of the current pane.
- **R-UX-003** Opening a pane closes all panes to the right of the pane the link was clicked from.
- **R-UX-004** A pane can be closed with its × button or `Esc` (rightmost first).
- **R-UX-005** The pane area scrolls horizontally when panes exceed the viewport width.
- **R-UX-006** The sidebar surfaces: Home, Review (with due count), Search, Library (Words/Kanji/Grammar/Texts), Sources, Topics.
- **R-UX-007** The Home pane shows today's SRS queue, latest source, recent additions, and exploration cards.
- **R-UX-008** Every entity page ends with a Backlinks section listing related entities, clickable as new panes.
- **R-UX-009** Japanese text renders in a Japanese-appropriate font; romaji/English in a sans-serif UI font.

## Command palette

- **R-UX-101** `⌘K` / `Ctrl+K` opens the palette; `Esc` closes it.
- **R-UX-102** The palette searches Words, Kanji, Grammar, Texts, and Topics.
- **R-UX-103** Matching is substring-based on kanji, kana, romaji, English, and topic.
- **R-UX-104** Results are ranked: exact > prefix > substring; kanji matches weighted higher.
- **R-UX-105** Enter opens the top result; arrow keys + Enter navigate the result list.

## Selection lookup

- **R-LOOK-001** Selecting Japanese text anywhere in a prose region shows a floating lookup popup.
- **R-LOOK-002** The popup displays reading, meaning, and the word's library/SRS status.
- **R-LOOK-003** The popup offers "+ Library", "+ SRS", and "Open" actions as applicable.
- **R-LOOK-004** Adding a word via the popup inserts it into the library and re-renders visible panes with the new highlight.
- **R-LOOK-005** Lookup consults the local dictionary first, then user overrides.
- **R-LOOK-006** Selections containing no Japanese characters are ignored.
- **R-LOOK-007** A word not found in the dictionary can still be added to the library with a user-supplied meaning.
- **R-LOOK-008** Hovering or clicking an already-linked word opens its page in a new pane; selecting over it still produces a lookup popup (for re-checking or adding to SRS).

## Text rendering & annotation

- **R-UX-201** Only words already in the user's library render as inline links; other text is plain.
- **R-UX-202** Words in the active SRS queue are visually distinct from library-only words.
- **R-UX-203** Adding a word via lookup causes all occurrences across open panes to update their rendering.

## SRS

- **R-SRS-001** Any Word, Kanji, or Grammar point can be toggled into/out of the SRS queue from its entity page.
- **R-SRS-002** The Review pane presents due cards one at a time with a prompt and a reveal-then-rate answer.
- **R-SRS-003** Rating buttons are Again, Hard, Good, Easy.
- **R-SRS-004** Scheduling uses SM-2 (v1); pluggable to support FSRS later.
- **R-SRS-005** SRS state persists across sessions (see persistence).
- **R-SRS-006** The sidebar Review entry shows the number of cards due today.

## Ingestion — shared

- **R-ING-001** All ingestion flows end by producing a Text entity with JP/EN line pairs.
- **R-ING-002** The shared editor supports selection-lookup while editing.
- **R-ING-003** Saving a Text indexes the words it contains (updates `appears-in` backlinks).
- **R-ING-004** A Text's source type, title, and source metadata are set at ingest time and editable later.
- **R-ING-005** Server request handling accepts bounded request bodies for JSON and file-ingest endpoints, with clear rejection when payloads exceed configured limits.

## Ingestion — teacher lessons

- **R-ING-101** Users paste teacher-email text; a parser extracts structured vocab (word / reading / meaning).
- **R-ING-102** The parsed vocab previews with checkboxes; user selects which entries to import.
- **R-ING-103** Import creates new Words (or reconciles with existing ones) and attaches them to a new lesson Text.
- **R-ING-104** Parser robustly handles the user's teacher's current format (see sample in conversation log).

## Ingestion — podcasts

- **R-ING-201** Users can upload an .mp3 (or link to one) to start a podcast transcription session.
- **R-ING-202** The session shows an audio player and a bilingual editor side-by-side.
- **R-ING-203** Keyboard shortcuts: Space = play/pause, ← = back 3s, → = forward 3s, Tab = new line.
- **R-ING-204** Optional reveal-after-commit mode: a hidden Whisper transcription is revealed line-by-line only after the user commits their own line.
- **R-ING-205** The resulting Text is tagged `source: podcast` with episode metadata.
- **R-ING-206** Podcast upload handling does not buffer unbounded audio responses or request bodies in memory.

## Ingestion — book OCR

- **R-ING-301** Users can drag-drop one or more photos of book pages.
- **R-ING-302** OCR produces JP text split by sentence boundaries.
- **R-ING-303** Each JP sentence has an editable EN line below it.
- **R-ING-304** Multi-page photos are concatenated in user-specified order into one Text.
- **R-ING-305** OCR provider is swappable (Claude Vision, Google Vision, Apple Vision locally).

## Confusables

- **R-CMP-001** A Kanji page includes components, stroke order, on/kun readings, and mnemonics (Kanji Damage style).
- **R-CMP-002** Kanji with known confusables show a "X vs Y" chip linking to a compare pane.
- **R-CMP-003** The compare pane shows side-by-side cards, a one-line component diff, and a drill card.
- **R-CMP-004** Confusable pairs are user-curated in v1; SRS-error-inferred pairs are a v2 feature.

## Dictionary infrastructure

- **R-DICT-001** Word lookups use a local JMdict-derived dictionary (JMdict-simplified JSON or SQLite).
- **R-DICT-002** Kanji metadata uses a local KANJIDIC2-derived dataset.
- **R-DICT-003** Long-text tokenization uses kuromoji.js (or equivalent morphological analyzer).
- **R-DICT-004** User overrides (custom meanings, mnemonics) are stored separately from dictionary data and merged at read time.
- **R-DICT-005** Dictionary and user data are accessible offline.

## Persistence

- **R-PERS-001** All user data (library, texts, SRS state, overrides) persists across sessions.
- **R-PERS-002** User data is exportable as a single archive (JSON or SQLite dump).
- **R-PERS-003** Single-user, local-first; no cloud sync in v1.
