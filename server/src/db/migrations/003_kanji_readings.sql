create table if not exists kanji_readings (
  id text primary key,
  kanji_literal text not null references kanji(literal),
  reading_type text not null check (reading_type in ('on', 'kun', 'unknown')),
  reading text not null,
  meaning text,
  usefulness text,
  position integer not null,
  source_record_id text references source_records(id)
);

create index if not exists idx_kanji_readings_kanji
  on kanji_readings(kanji_literal, reading_type, position);

create index if not exists idx_kanji_readings_reading
  on kanji_readings(reading);
