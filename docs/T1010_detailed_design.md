# T-1010 Detailed Design: Kanji Data Ingestion

## Goal

Import the Kanji Damage APKG into the app's local SQLite database as the first real kanji dataset.

This task should produce generic kanji and word data, not a Kanji Damage-specific domain model. Kanji Damage is the first source, but the storage model should leave room for later imports from KANJIDIC2, JMdict, hand-authored data, or other sources.

## Decisions

- Use SQLite as the source of truth.
- Use `better-sqlite3` for SQLite access.
- Hide direct database-driver usage behind a small server-side DB adapter.
- Store imported media as filesystem files under `.var/media`, not as SQLite BLOBs.
- Store only media metadata and storage paths in SQLite.
- Preserve imported Anki HTML, but render only a sanitized safe subset in the UI.
- If sanitized HTML creates too much UI/layout friction, move that section toward structured rendering.
- Treat kanji components as first-class display primitives separate from kanji.
- Preserve component forms as they appear inside kanji, such as `氵` and `忄`, rather than replacing them with full standalone kanji forms.
- Store one preferred stroke order image directly on each kanji row.
- Use the Kanji Damage stroke order images as the initial preferred stroke order source.
- Use a conventional relational model, not a graph database or generic graph abstraction.
- Keep Kanji Damage source/provenance tracking minimal until there is more than one kanji source.
- Perform the APKG import through a CLI script, not through a REST upload endpoint.
- Keep the initial REST API focused on the first kanji UI screen.
- Start with one kanji read endpoint: `GET /api/kanji/:literal`.
- Do not add separate source APIs yet.

## APKG Facts

`Official_KanjiDamage_deck_REORDERED.apkg` is a standard Anki package containing:

- `collection.anki2`: SQLite Anki collection.
- `media`: JSON mapping from numeric media ids to filenames.
- Numbered media files, including stroke order images, radical images, and visual aids.

The collection contains:

- 1 note model: `KanjiDamage`.
- 1,757 notes.
- 3,514 cards.

Useful note fields:

- `Number`
- `Kanji`
- `Meaning`
- `Stroke order`
- `Components`
- `Onyomi`
- `Mnemonic`
- `Usefulness`
- `First kunyomi`
- `First kunyomi meaning`
- `First kunyomi usefulness`
- `First jukugo`
- `First jukugo meaning`
- `First jukugo usefulness`
- `Full header`
- `Description`
- `Full onyomi`
- `Full mnemonic`
- `Full kunyomi`
- `Full jukugo`
- `Full lookalikes`
- `Full used In`
- `Frequency ranking`

The importer should preserve raw field values even when it also parses normalized values from them. Several high-value fields contain source HTML, and some radicals are represented as images or symbols rather than normal kanji characters.

## Relational Data Model

### SQLite Driver

The server and import CLI should use `better-sqlite3`.

Reasons:

- It preserves the project goal of avoiding runtime dependencies on Bun-specific APIs.
- It has a mature synchronous API that fits local-first SQLite usage.
- It supports prepared statements and explicit transactions, which are important for the APKG import.

Direct `better-sqlite3` usage should be isolated to a small DB adapter module under `server/src/db`. Application code should depend on repository/query functions rather than importing the driver directly.

### Import Sources

Source tracking is intentionally small for now. It exists to answer "where did this row come from?" and to support future merge work, but it should not drive the API or UI yet.

```sql
create table source_decks (
  id text primary key,
  name text not null,
  format text not null,
  file_name text not null,
  file_hash text not null,
  imported_at text not null
);

create table source_records (
  id text primary key,
  source_deck_id text not null references source_decks(id),
  external_id text not null,
  record_type text not null,
  raw_json text not null
);
```

For Kanji Damage:

- `source_decks.format = 'apkg'`
- `source_records.external_id` can be the Anki note id.
- `source_records.raw_json` should contain the field-name-to-value map.

### Kanji

```sql
create table kanji (
  literal text primary key,
  primary_meaning text not null,
  stroke_count integer,
  stroke_order_media_id text references media_assets(id),
  frequency_rank integer,
  usefulness text,
  source_record_id text references source_records(id),
  created_at text not null,
  updated_at text not null
);

create index idx_kanji_frequency_rank on kanji(frequency_rank);
```

`literal` is the primary identity for real kanji entries. Image-only or symbol radicals should not be forced into this table unless they are useful as standalone kanji-like entries.

Each kanji should have at most one preferred stroke order image. For T-1010, import the Kanji Damage `Stroke order` image into `media_assets` and set `kanji.stroke_order_media_id`. Do not add a separate generic kanji-media attachment table for stroke order unless later sources create a real need for alternatives.

### Component Primitives

Kanji components should not be modeled as only kanji-to-kanji links. Kanji Damage includes memorable snippets that are not formal radicals, and Japanese also has component forms that differ from their standalone kanji forms. For example, water often appears as `氵` rather than `水`, and heart often appears as `忄` rather than `心`.

Model these as first-class component primitives. A component primitive is a reusable visible form or mnemonic unit, not necessarily a dictionary radical and not necessarily a standalone kanji.

```sql
create table component_primitives (
  id text primary key,
  display text not null,
  meaning text,
  primitive_type text not null check (primitive_type in ('kanji_form', 'variant_form', 'symbol', 'image', 'unknown')),
  canonical_kanji_literal text references kanji(literal),
  media_id text references media_assets(id),
  source_record_id text references source_records(id)
);

create index idx_component_primitives_display on component_primitives(display);
create index idx_component_primitives_canonical_kanji on component_primitives(canonical_kanji_literal);
```

Examples:

- `目` as a `kanji_form` component, linked to canonical kanji `目`.
- `氵` as a `variant_form` component, linked to canonical kanji `水`.
- `忄` as a `variant_form` component, linked to canonical kanji `心`.
- Kanji Damage's `pi` image as an `image` component with a `media_id`.
- `L` or `<<<` as `symbol` components.

The term `component` is preferred in app code and UI. Avoid calling these all `radicals`, because many of them are mnemonic primitives rather than formal radicals.

### Kanji Components

`kanji_components` records the ordered component primitives that make up a kanji for display and study purposes.

```sql
create table kanji_components (
  id text primary key,
  kanji_literal text not null references kanji(literal),
  position integer not null,
  component_primitive_id text not null references component_primitives(id),
  source_record_id text references source_records(id)
);

create index idx_kanji_components_kanji on kanji_components(kanji_literal, position);
create index idx_kanji_components_primitive on kanji_components(component_primitive_id);
```

Examples:

- `具`: `目 (eye) + pi image radical`
- `好`: `子 (child) + 女 (woman)`

The UI should render the primitive's `display` or `media_id` exactly, and can link through `canonical_kanji_literal` when there is a meaningful kanji page to open.

### Readings

```sql
create table kanji_readings (
  id text primary key,
  kanji_literal text not null references kanji(literal),
  reading_type text not null check (reading_type in ('on', 'kun', 'unknown')),
  reading text not null,
  meaning text,
  usefulness text,
  source_record_id text references source_records(id)
);

create index idx_kanji_readings_kanji on kanji_readings(kanji_literal, reading_type);
create index idx_kanji_readings_reading on kanji_readings(reading);
```

Kanji Damage readings are not as canonical as KANJIDIC2 readings will be later. Treat them as useful display/study data, not final dictionary truth.

### Mnemonics

```sql
create table kanji_mnemonics (
  id text primary key,
  kanji_literal text not null references kanji(literal),
  mnemonic_type text not null check (mnemonic_type in ('meaning', 'onyomi', 'kunyomi', 'description', 'unknown')),
  text_html text not null,
  plain_text text,
  source_record_id text references source_records(id)
);

create index idx_kanji_mnemonics_kanji on kanji_mnemonics(kanji_literal);
```

Mnemonics are additive. Future sources should add more rows rather than overwrite existing rows.

Imported HTML should be preserved in `text_html`, but never rendered raw. The server or UI should sanitize before display and restrict rendering to kanji-content containers.

T-1010 should use a hybrid approach:

- Store raw source HTML in `source_records.raw_json`.
- Store display HTML in normalized rows where useful, such as `kanji_mnemonics.text_html`.
- Sanitize rendered HTML to a safe subset.
- Rewrite media references to `/api/media/:id`.
- Strip scripts, inline event handlers, unknown dangerous attributes, iframes, and unsafe URLs.
- Keep useful formatting tags such as `p`, `br`, `span`, `ruby`, `rt`, `rp`, `table`, `tbody`, `tr`, `td`, `th`, `ul`, `ol`, `li`, `strong`, `em`, `u`, `img`, and safe `a` links.

If sanitized Anki HTML causes too much visual or layout friction in the pane UI, prefer structured rendering for that section while continuing to preserve the raw source HTML for future parser improvements.

### Words

Words are generic app entities, not Kanji Damage jukugo rows.

```sql
create table words (
  id text primary key,
  expression text not null,
  reading text,
  primary_meaning text,
  source_record_id text references source_records(id),
  created_at text not null,
  updated_at text not null
);

create unique index idx_words_identity on words(expression, reading);
create index idx_words_expression on words(expression);
create index idx_words_reading on words(reading);
```

```sql
create table word_kanji (
  word_id text not null references words(id),
  kanji_literal text not null references kanji(literal),
  position integer not null,
  primary key (word_id, kanji_literal, position)
);

create index idx_word_kanji_kanji on word_kanji(kanji_literal);
```

```sql
create table word_meanings (
  id text primary key,
  word_id text not null references words(id),
  meaning text not null,
  source_record_id text references source_records(id)
);

create index idx_word_meanings_word on word_meanings(word_id);
```

For T-1010, Kanji Damage `Full jukugo` should create or merge `words`, `word_kanji`, and `word_meanings`.

### Kanji Relations

Keep this relational and purpose-specific. Do not introduce a generic graph abstraction.

```sql
create table kanji_relations (
  id text primary key,
  from_kanji_literal text not null references kanji(literal),
  to_kanji_literal text not null references kanji(literal),
  relation_type text not null check (relation_type in ('lookalike', 'used_in', 'component_of')),
  hint text,
  source_record_id text references source_records(id)
);

create index idx_kanji_relations_from on kanji_relations(from_kanji_literal, relation_type);
create index idx_kanji_relations_to on kanji_relations(to_kanji_literal, relation_type);
```

For T-1010:

- `Full lookalikes` maps to `lookalike`.
- `Full used In` can map to `used_in`.
- Parsed component links can map to `component_of` if useful, but `kanji_components` plus `component_primitives` remains the authoritative component model for display.

### Media

Imported APKG media should be copied to app-managed filesystem storage under `.var/media`. SQLite should store metadata and relative storage paths only. Do not store image, GIF, font, or SVG bytes as SQLite BLOBs.

The `.var` directory is local runtime state and should not be committed. A typical development layout:

```text
.var/
  amika.sqlite
  media/
    kanji-damage/
      <stable-file-name>
```

```sql
create table media_assets (
  id text primary key,
  source_deck_id text not null references source_decks(id),
  source_media_key text not null,
  file_name text not null,
  content_type text,
  file_hash text,
  storage_path text not null
);

create unique index idx_media_assets_source_key on media_assets(source_deck_id, source_media_key);
```

Media file names should be stable across repeated imports. Prefer a content hash plus the original extension when possible. The HTTP server should serve media via `GET /api/media/:id`, resolving the id through `media_assets`.

## Import Behavior

The CLI importer should:

1. Open the APKG as a zip archive.
2. Read `media` and copy media files into app-managed storage.
3. Extract `collection.anki2` into a temporary location.
4. Read the Anki note model to map field order to field names.
5. Iterate notes and create one `source_records` row per note.
6. Upsert `kanji` rows for normal kanji literals.
7. Import stroke order images into `media_assets` and set `kanji.stroke_order_media_id`.
8. Parse and insert readings, component primitives, kanji component rows, mnemonics, words, word links, relations, and media links.
9. Preserve raw field values in `source_records.raw_json`.
10. Run in a transaction or import into staging tables before swapping into place.

Import should be idempotent by `source_decks.file_hash` and `source_records.external_id`.

The importer should use the same DB adapter/repository layer as the server where practical, but it may use import-specific bulk helpers for transactional inserts.

## Merge Policy For Later Sources

No general merge UI is needed for T-1010, but the schema should not block it.

Initial policy:

- Kanji identity: `kanji.literal`.
- Word identity: `words(expression, reading)`.
- Mnemonics: additive.
- Word meanings: additive.
- Component primitives: merge by visible display plus canonical kanji/media where known.
- Kanji component decompositions: additive by source, but the UI can initially show the Kanji Damage component set.
- Stroke count and canonical readings should eventually prefer KANJIDIC2 when imported.
- Stroke order should remain a single preferred media reference on `kanji`; replace it only if a later source is explicitly chosen as better.

When a second kanji source lands, add explicit source priority and conflict handling then.

## Initial REST API

Only implement the endpoint needed by the first kanji UI.

```http
GET /api/kanji/:literal
```

Response shape:

```ts
type KanjiDetailResponse = {
  literal: string;
  meaning: string;
  strokeCount: number | null;
  frequencyRank: number | null;
  usefulness: string | null;
  strokeOrderImage: MediaAsset | null;
  components: Array<{
    display: string;
    meaning: string | null;
    primitiveType: "kanji_form" | "variant_form" | "symbol" | "image" | "unknown";
    kanjiLiteral: string | null;
    media: MediaAsset | null;
  }>;
  readings: Array<{
    type: "on" | "kun" | "unknown";
    reading: string;
    meaning: string | null;
    usefulness: string | null;
  }>;
  mnemonics: Array<{
    type: "meaning" | "onyomi" | "kunyomi" | "description" | "unknown";
    html: string;
    plainText: string | null;
  }>;
  words: Array<{
    id: string;
    expression: string;
    reading: string | null;
    meaning: string | null;
    usefulness: string | null;
  }>;
  relations: Array<{
    type: "lookalike" | "used_in" | "component_of";
    literal: string;
    meaning: string | null;
    hint: string | null;
  }>;
};

type MediaAsset = {
  id: string;
  url: string;
  contentType: string | null;
};
```

Do not implement these yet:

- `GET /api/kanji/:literal/words`
- `GET /api/kanji/:literal/relations`
- source APIs
- REST import endpoints

The server can query the relational tables in several small queries and compose this response as a view model. Avoid a large multi-join query for the whole screen.

## UI Direction

The first kanji UI should be compact and pane-friendly, not a direct clone of the Anki answer page.

For a kanji like `具`, show:

- Header: `具`, meaning `tool`, readings, SRS action placeholder.
- Metadata chips: stroke count, usefulness, frequency rank.
- Stroke order image.
- Components: `目 (eye) + pi`, with visual forms preserved exactly. Variant forms such as `氵` and `忄` should display as the learned in-kanji shape, while optionally linking to `水` or `心`.
- Mnemonics: source HTML rendered in a controlled/sanitized container. Move to structured rendering if the sanitized HTML has too much UI impact.
- Readings: grouped on/kun rows.
- Words: `道具`, `家具`, `具体的`, `具合`, etc.
- Relations: lookalikes and used-in rows.

The UI should consume `GET /api/kanji/:literal` directly.

## Open Questions

No remaining T-1010 design questions.
