create table if not exists source_decks (
  id text primary key,
  name text not null,
  format text not null,
  file_name text not null,
  file_hash text not null,
  imported_at text not null
);

create table if not exists source_records (
  id text primary key,
  source_deck_id text not null references source_decks(id),
  external_id text not null,
  record_type text not null,
  raw_json text not null
);

create unique index if not exists idx_source_records_identity
  on source_records(source_deck_id, external_id, record_type);

create table if not exists media_assets (
  id text primary key,
  source_deck_id text not null references source_decks(id),
  source_media_key text not null,
  file_name text not null,
  content_type text,
  file_hash text,
  storage_path text not null
);

create unique index if not exists idx_media_assets_source_key
  on media_assets(source_deck_id, source_media_key);

create table if not exists kanji (
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

create index if not exists idx_kanji_frequency_rank
  on kanji(frequency_rank);
