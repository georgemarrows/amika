create table if not exists srs_cards (
  id text primary key,
  kanji_literal text not null references kanji(literal),
  card_kind text not null check (card_kind in ('kanji_recognition', 'kanji_production')),
  enabled integer not null check (enabled in (0, 1)),
  scheduler_version text not null,
  state text not null check (state in ('new', 'learning', 'review', 'relearning')),
  due_at text not null,
  interval_days integer not null check (interval_days >= 0),
  ease_factor real not null check (ease_factor >= 0),
  reps integer not null check (reps >= 0),
  lapses integer not null check (lapses >= 0),
  last_reviewed_at text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists idx_srs_cards_kanji_kind
  on srs_cards(kanji_literal, card_kind);

create index if not exists idx_srs_cards_due
  on srs_cards(enabled, due_at, state, created_at, id);

create table if not exists srs_reviews (
  id text primary key,
  card_id text not null references srs_cards(id),
  reviewed_at text not null,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  previous_state_json text not null,
  next_state_json text not null
);

create index if not exists idx_srs_reviews_card_reviewed
  on srs_reviews(card_id, reviewed_at);

create table if not exists srs_import_links (
  id text primary key,
  card_id text not null references srs_cards(id),
  source text not null,
  source_collection_path text not null,
  source_deck_id text not null,
  source_deck_name text,
  source_note_id text not null,
  source_card_id text not null,
  source_card_ord integer not null,
  source_notetype_id text,
  source_template_name text,
  imported_at text not null
);

create unique index if not exists idx_srs_import_links_source_identity
  on srs_import_links(
    source,
    source_collection_path,
    source_deck_id,
    source_note_id,
    source_card_id
  );

create index if not exists idx_srs_import_links_card
  on srs_import_links(card_id);
