# Tasks

Sequenced implementation plan. Each task cites the requirement IDs it covers. Mark tasks `[ ]` → `[x]` as they land.

## Phase 0 — Prototype (current state)

- [x] T-0000 Single-file HTML prototype: tiling panes, command palette, inline SRS, selection lookup, Kanji-Damage-style kanji page, confusable compare. Seed data for a lesson, podcast snippet, and book reading.
  - Covers: R-UX-001..009, R-UX-101..105, R-UX-201..203, R-LOOK-001..008 (partial), R-SRS-001..003 (mock), R-CMP-001..003, R-DATA-001..006 (in-memory).

## Phase 1 — Real foundation

Goal: stop being a single HTML file; have a real dictionary and persistent storage.

- [x] T-1000 Project scaffolding: pick stack (TypeScript + Solid; SQLite via a small Node/Bun server).
- [ ] T-1010 Kanji Damage ingestion: load into SQLite with indices on character and readings. · R-DICT-002
- [ ] T-1020 Initial user interface for home page and kanji management (see docs/prototype.html)
- [ ] T-1030 Local JMdict ingestion: download jmdict-simplified, load into SQLite with indices on headword, reading, and English gloss. · R-DICT-001, R-DICT-005
- [ ] T-1040 Lookup API: `lookup(text) → {reading, meaning, jmdictId?}`; prefer exact, fall back to reading match. · R-LOOK-005, R-DICT-001
- [ ] T-1050 Persistence layer: user library (Words, Kanji overrides, Grammar, Texts, SRS state) in SQLite; migrations path. · R-PERS-001, R-DICT-004
- [ ] T-1060 Export: dump all user data to a single JSON/SQLite archive. · R-PERS-002
- [ ] T-1070 Port the prototype UI to the real stack; wire lookups and persistence end-to-end.

## Phase 2 — Book OCR ingest (most-exercising pipeline)

- [ ] T-2000 Ingest entry point: drag-drop image(s) anywhere in the app → new Text session. · R-ING-301
- [ ] T-2010 OCR integration (start with Claude Vision; abstract behind an interface). · R-ING-305
- [ ] T-2020 Sentence segmentation: split OCR output at 。!? and paragraph breaks; one JP line per sentence. · R-ING-302
- [ ] T-2030 Shared bilingual editor: JP/EN line pairs, edit, reorder, delete. · R-ING-001, R-ING-002
- [ ] T-2040 In-editor selection lookup: reuse popup; "+ Library" updates currently-visible panes. · R-LOOK-001..008
- [ ] T-2050 Save: create Text entity, index words, update backlinks. · R-ING-003

## Phase 3 — Lesson paste ingest

- [ ] T-3000 Paste entry: "New lesson" → textarea for email body. · R-ING-101
- [ ] T-3010 Parser: extract vocab rows from the teacher's email format (see conversation sample). · R-ING-104
- [ ] T-3020 Preview UI: checkbox list with editable reading/meaning per row. · R-ING-102
- [ ] T-3030 Import: create/reconcile Words and attach to a lesson Text. · R-ING-103

## Phase 4 — Podcast ingest

- [ ] T-4000 Upload + player: drop .mp3, show HTML5 audio player. · R-ING-201
- [ ] T-4010 Split-view editor. · R-ING-202
- [ ] T-4020 Shortcut bindings (Space, ←, →, Tab). · R-ING-203
- [ ] T-4030 Whisper integration (local whisper.cpp or API). · R-ING-204
- [ ] T-4040 Reveal-after-commit mode: hold Whisper lines, reveal on user commit. · R-ING-204

## Phase 5 — SRS proper

- [ ] T-5000 SM-2 scheduler: compute next review from rating + history. · R-SRS-004
- [ ] T-5010 Review pane: due queue, prompt→reveal→rate flow, session summary. · R-SRS-002..003
- [ ] T-5020 Due count in sidebar wired to live queue. · R-SRS-006
- [ ] T-5030 SRS history persisted per entity. · R-SRS-005, R-PERS-001

## Phase 6 — Tokenization & auto-highlight

- [ ] T-6000 kuromoji.js integration. · R-DICT-003
- [ ] T-6010 Tokenize long texts; highlight library words more accurately (no substring false positives). · R-UX-201
- [ ] T-6020 Unknown-word suggestions: suggest adding high-frequency unknown words from a text. (nice-to-have)

## Phase 7 — Confusables v2

- [ ] T-7000 Manual confusable-pair CRUD. · R-CMP-004
- [ ] T-7010 SRS-error-inferred pairs: when the user fails kanji A but their answer matches kanji B, suggest the pair. (v2)

## Deferred / open

- Auto-ingest from email (forward-to address).
- Cloud sync / multi-device.
- Mobile.
- Multi-user / sharing.
