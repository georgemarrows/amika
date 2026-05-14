## Requirements

- T-30200 should implement real persisted SRS state for kanji first, while keeping the model open for words and grammar later.
- A kanji entering SRS creates two independent review cards:
  - recognition: prompt with the kanji literal; answer with readings and English meaning.
  - production: prompt with readings and English meaning; answer with the kanji literal.
- Recognition and production must schedule independently. A kanji can be mature for recognition while still weak for production.
- Review ratings are Again, Hard, Good, Easy.
- The kanji page can still present a simple SRS toggle, but detailed status should be per card kind.
- A minimal scheduler still counts as SRS if it can show due cards, record each answer, and update the next due date from the answer plus previous card state.

## Anki SRS algorithms

- The current reference deck is on Anki 25.02.6 with FSRS disabled, so it is using Anki's legacy SM-2-derived scheduler.
- Anki's modern scheduler generation is v3, but the interval algorithm in this deck is the legacy SM-2 path rather than FSRS.
- Amika should start with a small SM-2-compatible scheduler shape: state, due time, interval, ease factor, reps, lapses, and learning/relearning state.
- FSRS should be treated as a future scheduler implementation behind the same card-state interface, not as a requirement for T-30200.

## Amika datamodel

- Model SRS state at the card level, not the entity level.
- `srs_cards` should store both card identity and current scheduler state. A separate one-to-one `srs_card_state` table is not needed for T-30200.
  - Primary key: `id`.
  - Foreign key: `kanji_literal` references `kanji(literal)`.
  - Unique identity for T-30200: `(kanji_literal, card_kind)`.
  - Use deterministic card ids where practical, for example one stable id per `(kanji_literal, card_kind)`.
  - Identity columns: `kanji_literal`, `card_kind`.
  - Current state columns: `enabled`, `scheduler_version`, `state`, `due_at`, `interval_days`, `ease_factor`, `reps`, `lapses`, `last_reviewed_at`, `created_at`, `updated_at`.
  - `card_kind` starts with `kanji_recognition` and `kanji_production`.
  - `state` starts with `new`, `learning`, `review`, `relearning`.
  - Removing a kanji from SRS should keep the card rows and history, but set `enabled = false` so they are hidden from the queue.
  - When words and grammar become reviewable, add explicit foreign keys or a reviewed-entity table rather than relying on an unenforced polymorphic `entity_id`.
- `srs_reviews` should be append-only review history.
  - Primary key: `id`.
  - Foreign key: `card_id` references `srs_cards(id)`.
  - Review columns: `reviewed_at`, `rating`, `previous_state_json`, `next_state_json`.
  - Optional later columns: `duration_ms`, scheduler debug fields, import provenance.
  - Review ids can be generated; they do not need deterministic ids.
- `srs_import_links` should preserve source-card provenance for imported scheduling state.
  - Primary key: `id`.
  - Foreign key: `card_id` references `srs_cards(id)`.
  - Unique source identity: `(source, source_collection_path, source_deck_id, source_note_id, source_card_id)`.
  - Source columns: `source`, `source_collection_path`, `source_deck_id`, `source_deck_name`, `source_note_id`, `source_card_id`, `source_card_ord`, `source_notetype_id`, `source_template_name`, `imported_at`.
- A future Anki import can map Anki cards onto Amika card kinds, but Amika should not import or preserve Anki's note/card template model as the runtime model.

## UI for testing
- see [prototype](./srs-review-prototype.html)
- The first implementation should support the prototype flow: show one due card, reveal the answer, choose Again/Hard/Good/Easy, then advance to the next due card.

## Anki import
- Goal: seed Amika `srs_cards` current state from the user's existing Anki `_Work / KLC` deck without importing Anki's note/card template model as Amika's runtime model.
- Until cutover, Anki remains the source of truth for this deck's SRS state. Amika SRS state can be discarded/replaced when importing from Anki.
- Observed local source:
  - App bundle: `/Applications/Anki 2.app`.
  - User profile DB: `/Users/georgem/Library/Application Support/Anki2/User 1/collection.anki2`.
  - Anki was running during inspection, so read from a temporary copy of `collection.anki2` plus `collection.anki2-wal` rather than the live DB.
  - Direct read-only opens can fail while the WAL exists. The importer should require Anki to be closed before import.
- Observed deck:
  - Anki stores deck hierarchy separators as U+001F, so `_Work / KLC` appears as `_Work\x1fKLC`.
  - Deck id: `1735059724848`.
  - Snapshot counts: `1064` cards total, `256` new, `1` learning, `807` review.
- Relevant Anki tables:
  - `decks`: deck id/name lookup.
    - Primary key: `decks.id`.
  - `cards`: current scheduler state.
    - Primary key: `cards.id`.
    - Foreign keys by convention: `cards.nid` references `notes(id)`, `cards.did` references `decks(id)`.
    - Relevant columns: `nid`, `did`, `ord`, `type`, `queue`, `due`, `ivl`, `factor`, `reps`, `lapses`, `left`, `odue`, `odid`.
  - `notes`: source note fields.
    - Primary key: `notes.id`.
    - Foreign key by convention: `notes.mid` references `notetypes(id)`.
    - Relevant columns: `mid`, `flds`.
  - `fields` and `templates`: field/template metadata for modern Anki schemas.
    - Composite primary keys: `fields(ntid, ord)`, `templates(ntid, ord)`.
  - `revlog`: review history, if later imported.
    - Primary key: `revlog.id`.
    - Foreign key by convention: `revlog.cid` references `cards(id)`.
- KanjiDamage mapping:
  - Main note type id observed: `1414923096984`, name `KanjiDamage`.
  - Field order includes `Kanji`, `Meaning`, `Onyomi`, `First kunyomi`, and existing parsed Kanji Damage import code already knows this field shape.
  - Template `ord = 0`, name `Write`, maps to Amika `kanji_production`.
  - Template `ord = 1`, name `Read`, maps to Amika `kanji_recognition`.
  - For each imported Anki card, read the note's `Kanji` field, find or create the corresponding Amika `srs_cards(kanji_literal, card_kind)` row, copy current scheduling state, then insert/update `srs_import_links`.
- State mapping:
  - Anki `cards.queue = 0` and `cards.type = 0`: Amika state `new`.
  - Anki `cards.queue = 1`: Amika state `learning`; Anki `due` is an absolute Unix timestamp in seconds.
  - Anki `cards.queue = 2`: Amika state `review`; Anki `due` is a day number relative to collection creation `col.crt`.
  - Suspended cards should import as `enabled = false`.
  - Buried and filtered cards should be skipped with a report unless inspection shows they matter.
  - Convert review-card due day to Amika UTC `due_at` using `col.crt + cards.due * 86400` as a simple first pass, then display/group in local time.
  - Convert Anki `factor` integer to Amika `ease_factor` decimal by dividing by `1000`; if `factor = 0` on learning/new cards, seed Amika's default ease.
  - Copy `ivl` to `interval_days`, `reps` to `reps`, and `lapses` to `lapses`.
  - Preserve the original Anki values in `srs_import_links` or a dry-run report so import decisions are auditable.
- Initial importer behavior:
  - Require Anki to be closed. Refuse to run if the profile appears active or if `collection.anki2-wal` is present.
  - Start as a read-only dry-run that reports deck match, card counts, skipped cards, and proposed Amika card state changes.
  - When applying an import before cutover, treat Anki as authoritative: replace existing Amika SRS state for imported kanji cards rather than trying to merge histories.
  - Do not import Anki `revlog` for T-30200. The current `cards` table is enough to seed Amika's queue and continue reviewing from Anki's current state.
  - Without `revlog`, Amika stats start from cutover day. Historical Anki review history, FSRS training data, and long-term error/confusable analysis can be revisited later if needed.
  - Do not import non-KanjiDamage notes in `_Work / KLC` into kanji SRS. The observed deck contains a small number of `Basic (and reversed card)` cards; report them as skipped unless a separate mapping is designed.
- Open import questions:
  - None for T-30200. Future work can revisit Anki `revlog` import if historical stats, FSRS training, or confusable inference become important.


## Scheduler details
- Use a simple SM-2-ish scheduler for T-30200 rather than trying to match Anki exactly.
- Card selection:
  - Include active cards where `enabled = true`.
  - Show cards due today or overdue.
  - Sort due cards before new cards.
  - New cards should have `due_at` set to creation time so they are available immediately, but still sort after due/overdue review cards.
  - Interleave recognition and production naturally in the queue.
  - No daily caps for T-30200.
  - No sibling burying for T-30200; recognition and production for the same kanji may both appear in one session.
- Due-time semantics:
  - Use a simple timezone-safe approach: store `due_at` as an absolute UTC timestamp.
  - For display and "due today" grouping, interpret timestamps in the user's local timezone.
  - Avoid Anki-style day-boundary configuration in T-30200.
- Initial state:
  - Adding a kanji to SRS creates both `kanji_recognition` and `kanji_production`.
  - Both cards start as `new`.
  - Default initial ease factor is `2.5`.
- Card kind naming:
  - `kanji_recognition`: show kanji; answer readings and English meaning.
  - `kanji_production`: show readings and English meaning; answer kanji.
- Review answer data:
  - Render answers from existing kanji/readings data, not duplicated SRS table columns.
- Transaction boundary:
  - Rating submission should be one transaction: read current card state, schedule next state, insert `srs_reviews`, and update `srs_cards`.
- Minimal scheduling behavior:
  - New card + Again: due in 5 minutes, state `learning`.
  - New card + Hard: due in 10 minutes, state `learning`.
  - New card + Good: due in 1 day, state `review`, interval `1`.
  - New card + Easy: due in 4 days, state `review`, interval `4`.
  - Review card + Again: due in 10 minutes, state `relearning`, increment `lapses`, interval `0`.
  - Review card + Hard: due in `max(1, round(interval_days * 1.2))` days.
  - Review card + Good: due in `round(interval_days * ease_factor)` days.
  - Review card + Easy: due in `round(interval_days * ease_factor * 1.3)` days.
  - Ease factor floor: `1.3`.
  - Again lowers ease by `0.20`; Hard lowers ease by `0.15`; Good leaves ease unchanged; Easy raises ease by `0.15`.
- Every rating appends one `srs_reviews` row and updates the current state on `srs_cards`.

## Implementation plan
- Build in three implementation rounds:
  - Round 1, SRS core: migration, domain types, pure `simple_sm2_v1` scheduler, repository helpers, and review service.
  - Round 2, Anki import: closed-profile dry-run/apply for `_Work / KLC`, KanjiDamage card mapping, state replacement, provenance, and skipped-card report.
  - Round 3, UI integration: API routes, client state helpers, Review pane reveal/rate flow, kanji SRS status/toggle, and sidebar due count.
- Keep importer and live review behavior separate:
  - Import writes current state and provenance.
  - Imported cards use Anki-derived current state, but future Amika reviews proceed with `scheduler_version = simple_sm2_v1`.
  - Review submission appends `srs_reviews` and advances one card through the scheduler.
  - The UI should not calculate scheduling; it only sends the selected rating.

## Scheduler interface
- Keep the scheduler as a pure functional boundary: data in, data out, no database access, no clock reads inside the scheduler.
- Suggested input shape:
  - `card`: current state fields from `srs_cards`.
  - `rating`: `again`, `hard`, `good`, or `easy`.
  - `reviewedAt`: injected timestamp.
  - `config`: scheduler version/config values such as default ease, ease floor, new-card steps, and interval multipliers.
- Suggested output shape:
  - `nextCardState`: the exact fields to write back to `srs_cards`.
  - `review`: the fields to insert into `srs_reviews`, including previous/next state snapshots.
  - Optional `debug`: scheduler-specific explanation values for tests or later inspection.
- Store `scheduler_version` on each card so future implementations can coexist or migrate deliberately.
- Scheduler implementations should be swappable by a small registry keyed by `scheduler_version`, for example `simple_sm2_v1` now and `fsrs_v1` later.

## Charts & stats
- Keep review history indefinitely for now. This supports simple stats, debugging, and future scheduler experiments.

## Testing
- Unit-test the scheduler as pure functions:
  - Freeze `reviewedAt` in each test.
  - Cover each rating for `new`, `learning`, `review`, and `relearning` cards.
  - Assert complete next-state objects, not only due dates.
  - Include edge cases: ease floor, zero/one-day intervals, repeated lapses, and minute-based learning due dates.
- Repository/service tests should use a temporary SQLite DB:
  - Applying a rating inserts exactly one `srs_reviews` row and updates exactly one `srs_cards` row.
  - Due-card queries include overdue/today cards and exclude disabled/future cards.
  - Removing from SRS hides cards but preserves review history.
  - Recognition and production cards for one kanji schedule independently.
- Importer tests should use small fixture Anki SQLite DBs or copied minimal fixtures:
  - Finds `_Work / KLC` by deck name.
  - Maps KanjiDamage `Write`/`Read` templates to the correct Amika card kinds.
  - Replaces existing Amika imported state when Anki is authoritative.
  - Reports/skips non-KanjiDamage cards.
- UI tests can stay thin for T-30200:
  - The Review pane renders a due card, reveal button, answer, and rating buttons.
  - Submitting a rating advances to the next card and updates the due count.

## Backups
- moved to T-30250
 - Migration/rebuild path: because this adds local runtime state, we should document fresh-checkout behavior and backup expectations when implementing.
