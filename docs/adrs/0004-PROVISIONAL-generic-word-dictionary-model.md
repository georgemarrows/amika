# ADR 0004: PROVISIONAL Generic Word Dictionary Model

## Status

Provisional.

## Context

Amika needs to represent Japanese words as part of a wider graph of texts, words, kanji, grammar, and review state. A flat `words(expression, reading, primary_meaning)` table is useful for early pane work and Kanji Damage jukugo import, but it is not a sufficient long-term lexical model.

Japanese word identity is not the same thing as an English translation. One lexical entry can have multiple written forms, readings, senses, and glosses. Multiple English glosses may be alternate translations of the same sense, while some identical-looking or identical-sounding Japanese forms are genuinely separate lexical entries. Kana-only text can also be ambiguous without context.

The app should preserve enough structure to support lookup, backlinks, highlighting, SRS, and pane-to-pane navigation without making a specific external dictionary format the permanent domain model.

## Decision

Use a generic dictionary-entry model as the long-term target. Keep raw source payloads for rebuildability, but extract relational projections for the fields the app needs to query and navigate.

Dictionary source layer:

```text
dictionary_entries
  PK id

  source                  -- e.g. imported dictionary name
  source_entry_id          -- stable id from that source, when available
  raw_json                 -- full source payload for rebuild/reimport/debugging
  primary_form             -- display-oriented projection
  primary_reading          -- display-oriented projection
  primary_gloss            -- display-oriented projection
```

```text
dictionary_entry_forms
  PK id
  FK entry_id -> dictionary_entries.id

  text                     -- written form or kana-only form
  form_kind                -- kanji, kana, mixed, other
  is_common
  priority_tags
  info_tags
```

```text
dictionary_entry_readings
  PK id
  FK entry_id -> dictionary_entries.id

  text
  is_common
  priority_tags
  info_tags
```

Sense layer:

```text
dictionary_senses
  PK id
  FK entry_id -> dictionary_entries.id

  position                 -- source/order-preserving sense order
  part_of_speech_tags
  field_tags
  misc_tags
  dialect_tags
  info
```

```text
dictionary_sense_glosses
  PK id
  FK sense_id -> dictionary_senses.id

  language
  text
  position
```

Optional restriction layer, deferred until needed:

```text
dictionary_reading_form_restrictions
  PK id
  FK reading_id -> dictionary_entry_readings.id
  FK form_id -> dictionary_entry_forms.id
```

```text
dictionary_sense_form_restrictions
  PK id
  FK sense_id -> dictionary_senses.id
  FK form_id -> dictionary_entry_forms.id
```

```text
dictionary_sense_reading_restrictions
  PK id
  FK sense_id -> dictionary_senses.id
  FK reading_id -> dictionary_entry_readings.id
```

User-facing word layer, deferred until user library work:

```text
user_words
  PK id
  FK dictionary_entry_id -> dictionary_entries.id nullable
  FK selected_sense_id -> dictionary_senses.id nullable

  display_form
  reading
  custom_meaning
  status
  created_at
  updated_at
```

```text
user_word_senses
  PK id
  FK user_word_id -> user_words.id
  FK dictionary_sense_id -> dictionary_senses.id nullable

  custom_gloss
  is_primary
```

Kanji links:

```text
dictionary_entry_kanji
  PK id
  FK entry_id -> dictionary_entries.id
  FK kanji_literal -> kanji.literal

  position
```

```text
user_word_kanji
  PK id
  FK user_word_id -> user_words.id
  FK kanji_literal -> kanji.literal

  position
```

The T-1010e implementation should not build this full model. For T-1010e, use the smaller app-facing `words`, `word_meanings`, and `word_kanji` projection needed to import and render Kanji Damage jukugo rows. That early table should be documented as a projection that can later be linked to, rebuilt from, or replaced by the generic dictionary-entry model.

## Consequences

The long-term model separates lexical truth from user learning state. Dictionary entries describe what words and senses exist; user word rows describe what the learner has chosen to study, how it should display, and which meaning or custom wording matters to them.

Storing raw source payloads keeps imports recoverable and lets future migrations rebuild derived tables when the model changes. Extracting relational projections avoids parsing opaque payloads for lookup, backlinks, search, highlighting, and pane navigation.

The model remains generic rather than tied to one dictionary format. It can preserve the useful concepts common to rich dictionaries: entries, forms, readings, senses, glosses, tags, restrictions, and source order. Format-specific quirks stay in importer code and raw payloads.

The cost is more schema than T-1010e needs. To avoid premature build-out, early tasks should implement only the projection tables that unlock current UI behavior, then introduce dictionary-entry and user-word layers when lookup, ingestion, and SRS require them.
