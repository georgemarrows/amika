# ADR 0004: Store Dictionary Entries with Search Projections

## Status

Accepted.

## Context

Amika will use JMdict via `jmdict-simplified` for word lookup. A JMdict entry already represents the lexical structure required for display: multiple written forms, readings, senses, glosses, restrictions, tags, and cross-references.

The word actions and initial search behavior are specified in [spec.md section 8](../spec.md#8-actions-for-different-data-types). A word pane represents a dictionary entry, including when it is reached through an alternative written form. Search must cover loaded dictionary data by written form, normalized reading, English meaning, and single-kanji membership. Initial word search is exact or prefix-based; broad internal substring search is deferred.

The application does not currently require SQL queries over individual JMdict senses, restrictions, or cross-references. Recreating JMdict's semantic model as relational application tables would add schema and importer complexity before it unlocks required behavior.

## Decision

Store one imported row per dictionary entry. The complete imported `jmdict-simplified` entry JSON is the dictionary truth used to render a full word pane. Store only the small derived projections needed for efficient search and result summaries alongside it.

Dictionary entries:

```text
dictionary_entries
  PK id

  source                  -- e.g. jmdict-simplified
  source_entry_id         -- stable source identifier, e.g. JMdict entry sequence
  raw_json                -- complete imported entry payload used for display

  display_form            -- preferred form for summaries
  display_reading         -- preferred reading for summaries
  display_gloss           -- preferred English gloss for summaries
  ranking_score           -- nullable source-derived ordering signal

  lookup_forms_ja         -- searchable written/kana forms only
  lookup_readings_hira    -- searchable readings normalized to hiragana
  contained_kanji         -- searchable distinct kanji extracted from forms
  glosses_en              -- searchable English gloss text

  UNIQUE (source, source_entry_id)
```

Do not populate `lookup_forms_ja`, `lookup_readings_hira`, or `contained_kanji` by collecting arbitrary Japanese strings from `raw_json`. Cross-references, antonyms, notes, or future example sentences must not cause an entry to match as though they were its headword.

Use a search index, such as SQLite FTS5, over the extracted search fields. Exact and prefix searches resolve dictionary entry IDs, after which the server reads `raw_json` to render the selected entry. Single-kanji "words containing it" search uses `contained_kanji`. Internal multi-character substring search may add a more specialized derived index later if it becomes required and performs poorly as a direct filtered query.

Whether `contained_kanji` search includes rare or irregular alternative forms remains a presentation/search-ranking policy decision in the spec. It does not require normalizing the entry: all forms remain available in `raw_json`, and search projections can be rebuilt when the policy is decided.

User state does not become part of imported dictionary truth. When a dictionary entry is added to the library or SRS, user-owned state may reference `dictionary_entries.id` and must preserve the encountered form and learner-facing meaning selected at the time of addition. It need not reference a normalized dictionary-sense row.

Sentence backlinks are also user-owned state. Initially create word-to-sentence relations only when the user explicitly adds or links a word in their library; do not precompute dictionary links for every token in imported text.

The existing `words`, `word_meanings`, and `word_kanji` tables used for Kanji Damage examples predate the JMdict import. This ADR defines the T-30500 dictionary source model; migrating or reconciling the earlier imported word projection is a separate implementation decision.

## Consequences

The dictionary import schema remains small and source-faithful: one relational row retains the complete JMdict-derived entry, while indexed text projections provide the lookups required by the UI. Full entry display does not require reconstructing a lexical entry through relational joins.

The model deliberately couples rendering interpretation to the selected imported JSON format. This is acceptable while JMdict via `jmdict-simplified` is the selected word dictionary source; support for another format would require its own importer into the app-facing entry payload or a later model revision.

Search projections duplicate information from `raw_json`, but they are derived import artifacts rather than independent truth. Imports and migrations must rebuild them deterministically.

If future features need SQL-level operations over individual senses, restrictions, cross-references, or all dictionary-to-text relationships, targeted additional projections can be introduced then. They are not required for the initial dictionary, navigation, or SRS behavior specified today.
