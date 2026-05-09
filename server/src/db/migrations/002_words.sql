create table if not exists words (
  id text primary key,
  expression text not null,
  reading text,
  primary_meaning text,
  usefulness text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists idx_words_identity
  on words(expression, reading);

create index if not exists idx_words_expression
  on words(expression);

create index if not exists idx_words_reading
  on words(reading);

create table if not exists word_meanings (
  id text primary key,
  word_id text not null references words(id),
  meaning text not null,
  position integer not null
);

create unique index if not exists idx_word_meanings_identity
  on word_meanings(word_id, meaning);

create index if not exists idx_word_meanings_word
  on word_meanings(word_id);

create table if not exists word_kanji (
  word_id text not null references words(id),
  kanji_literal text not null references kanji(literal),
  position integer not null,
  primary key (word_id, kanji_literal, position)
);

create index if not exists idx_word_kanji_kanji
  on word_kanji(kanji_literal);
