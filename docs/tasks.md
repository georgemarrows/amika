# Tasks

Sequenced implementation plan. Each task cites the requirement IDs it covers. Mark tasks `[ ]` → `[x]` as they land.

## Tech debt 
- [ ] T-10000 Explore simplifications for backend, Tanstack etc

## Meta work
- [ ] T-20000 Clean up Phase 1 task list

## Next up
- [x] T-30000a load a single kanji with all readings.
- [x] T-30000b load all Kanji Damage kanji, readings and example words. Not data that isn't already being handled (like mnemonics, components, relations)
- [x] T-30049 Out of order: full review of existing codebase - see docs/review*.md
- [ ] T-30050 At some point: review review comments and fix most important. Done: client. Still to review: server & overall.
- [x] T-30100 Search - see docs/30100-search for details
- [ ] T-30200 Simple @docs/30200-srs/srs-plan.md 
- [x] T-30200a Round 1 SRS Core
- [ ] T-30200b Round 2 Anki importer
- [ ] T-30200c Round 3 UI & endpoints
- [ ] T-30250 Backups
- [ ] T-30300 Import Anki status?
- [ ] T-30400 Add example sentences. Following deleted non-words could go in examples
```json
     {
        "expression": "1969年",
        "reading": "1969ねん",
        "meaning": "Oh, No! Please God help meeeeee. . . .:("
      },
      {
        "expression": "2時半",
        "reading": "にじはん",
        "meaning": "2:30"
      },
      {
        "expression": "XXX専",
        "reading": "XXXせん",
        "meaning": "specialist in xxx"
      },
      {
        "expression": "XXX症",
        "reading": "XXXしょう",
        "meaning": "XXX - disease"
      },
      {
        "expression": "xxx人",
        "reading": "じん",
        "meaning": "person from xxx"
      },
      {
        "expression": "昨 XXX",
        "reading": "saku - XXX",
        "meaning": "last - xxx"
      },
      {
        "expression": "第7章",
        "reading": "だいななしょう",
        "meaning": "chapter 7"
      },
      {
        "expression": "８時頃",
        "reading": "はちじごろ",
        "meaning": "around 8-ish"
      },
      {
        "expression": "９条",
        "reading": "きゅうじょう",
        "meaning": "article 9"
      }
```

# Future epics (unprioritized)

## Full Kanji Damage loading
  - [ ] T-1010c Readings + mnemonics: add kanji readings and mnemonics tables; parse Kanji Damage onyomi, mnemonic, first kunyomi, and useful full mnemonic HTML; sanitize rendered HTML; extend the kanji endpoint and UI. · R-DATA-002, R-DICT-002, R-CMP-001
  - [ ] T-1010d Components: add component primitives and kanji components; parse Kanji Damage components, including image/symbol primitives and variant forms; expose and render components near the top of the kanji UI. · R-DATA-002, R-DICT-002, R-CMP-001
  - [ ] T-1010f Relations: add kanji relations; parse Kanji Damage lookalikes and used-in data; expose relations through the kanji endpoint and render compact related-kanji sections. · R-DATA-002, R-DATA-006, R-CMP-001..003, R-DICT-002
  - [ ] T-1010g Full import hardening: make the APKG import idempotent, transactional, and repeatable across the full deck; add import summaries, parser fixtures/tests, error reporting, and media cleanup behavior. · R-DICT-002, R-DICT-005, R-PERS-001


## UI improvements
* Full keyboard nav

## Export: dump all user data to a single JSON/SQLite archive. · R-PERS-002


## Local JMdict ingestion: download jmdict-simplified, load into SQLite with indices on headword, reading, and English gloss. ·
 R-DICT-001, R-DICT-005


## Phase 2 — Book OCR ingest (most-exercising pipeline)


## Phase 3 — Lesson paste ingest


## Phase 4 — Podcast ingest


## Phase 5 — SRS proper


## Phase 6 — Tokenization & auto-highlight


## Phase 7 — Confusables v2


## Deferred / open

- Auto-ingest from email (forward-to address).
- Cloud sync / multi-device.
- Mobile.
- Multi-user / sharing.


# Archive

## Phase 0 — Prototype (current state)

- [x] T-0000 Single-file HTML prototype: tiling panes, command palette, inline SRS, selection lookup, Kanji-Damage-style kanji page, confusable compare. Seed data for a lesson, podcast snippet, and book reading.
  - Covers: R-UX-001..009, R-UX-101..105, R-UX-201..203, R-LOOK-001..008 (partial), R-SRS-001..003 (mock), R-CMP-001..003, R-DATA-001..006 (in-memory).

## Foundations

Goal: stop being a single HTML file; have a real dictionary and persistent storage.

- [x] T-1000 Project scaffolding: pick stack (TypeScript + Solid; SQLite via a small Node/Bun server).

The following 1010 subtasks reference T1010_detailed_design.md.
- [x] T-1010a Minimal DB + one-kanji import: add `better-sqlite3`, DB adapter, migration runner, `.var/amika.sqlite`, `.var/media`; create minimal source/media/kanji schema; add a CLI importer that can load enough Kanji Damage data to fetch `具`. · R-DICT-002, R-DICT-005, R-PERS-001
- [x] T-1010b First kanji API + UI pane: implement `GET /api/kanji/:literal` with literal, meaning, stroke count, usefulness, frequency rank, and stroke image; add/modify UI so a kanji detail view can open using real imported data. · R-DICT-002, R-UX-001..005, R-UX-009, R-CMP-001
- [x] T-1010e Jukugo words: add generic words, word-kanji links, and word meanings; parse Kanji Damage first/full jukugo; expose words through the kanji endpoint and render them in the UI. · R-DATA-001, R-DATA-002, R-DATA-006, R-DICT-002
- [x] T-1010ea Refactor client code
- [x] T-1010eb Move tests?
