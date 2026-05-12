import type { KanjiReading, KanjiReadingType } from "../../../shared/kanji-reading.js";
import type { SearchResultItem } from "../../../shared/search.js";
import type { Db } from "./connection.js";

export type SourceDeckInput = {
  id: string;
  name: string;
  format: string;
  fileName: string;
  fileHash: string;
  importedAt: string;
};

export type SourceRecordInput = {
  id: string;
  sourceDeckId: string;
  externalId: string;
  recordType: string;
  rawJson: string;
};

export type MediaAssetInput = {
  id: string;
  sourceDeckId: string;
  sourceMediaKey: string;
  fileName: string;
  contentType: string | null;
  fileHash: string;
  storagePath: string;
};

export type KanjiInput = {
  literal: string;
  primaryMeaning: string;
  strokeCount: number | null;
  strokeOrderMediaId: string | null;
  frequencyRank: number | null;
  usefulness: string | null;
  sourceRecordId: string | null;
  now: string;
};

export type KanjiStubInput = {
  literal: string;
  primaryMeaning: string;
  sourceRecordId: string | null;
  now: string;
};

export type WordInput = {
  id: string;
  expression: string;
  reading: string | null;
  primaryMeaning: string | null;
  usefulness: string | null;
  now: string;
};

export type WordMeaningInput = {
  id: string;
  wordId: string;
  meaning: string;
  position: number;
};

export type WordKanjiInput = {
  wordId: string;
  kanjiLiteral: string;
  position: number;
};

export type KanjiReadingInput = {
  id: string;
  kanjiLiteral: string;
  readingType: KanjiReadingType;
  reading: string;
  meaning: string | null;
  usefulness: string | null;
  position: number;
  sourceRecordId: string | null;
};

export type MediaAssetRow = {
  id: string;
  sourceDeckId: string;
  sourceMediaKey: string;
  fileName: string;
  contentType: string | null;
  fileHash: string | null;
  storagePath: string;
};

export type KanjiRow = {
  literal: string;
  primaryMeaning: string;
  strokeCount: number | null;
  strokeOrderMediaId: string | null;
  frequencyRank: number | null;
  usefulness: string | null;
  sourceRecordId: string | null;
  createdAt: string;
  updatedAt: string;
  strokeOrderMedia: MediaAssetRow | null;
};

export type WordSummaryRow = {
  id: string;
  expression: string;
  reading: string | null;
  meaning: string | null;
  usefulness: string | null;
};

export type KanjiListRow = {
  literal: string;
  meaning: string;
  strokeCount: number | null;
  frequencyRank: number | null;
  usefulness: string | null;
};

export type WordListRow = WordSummaryRow;

export type WordMeaningRow = {
  id: string;
  meaning: string;
  position: number;
};

export type WordKanjiRow = {
  literal: string;
  meaning: string | null;
  position: number;
};

export type KanjiReadingRow = KanjiReading & {
  position: number;
};

export type WordDetailRow = {
  id: string;
  expression: string;
  reading: string | null;
  primaryMeaning: string | null;
  usefulness: string | null;
  createdAt: string;
  updatedAt: string;
  meanings: WordMeaningRow[];
  kanji: WordKanjiRow[];
};

type SearchWordRow = {
  id: string;
  expression: string;
  reading: string | null;
  primary_meaning: string | null;
};

type KanjiQueryRow = {
  literal: string;
  primary_meaning: string;
  stroke_count: number | null;
  stroke_order_media_id: string | null;
  frequency_rank: number | null;
  usefulness: string | null;
  source_record_id: string | null;
  created_at: string;
  updated_at: string;
  media_id: string | null;
  media_source_deck_id: string | null;
  media_source_media_key: string | null;
  media_file_name: string | null;
  media_content_type: string | null;
  media_file_hash: string | null;
  media_storage_path: string | null;
};

function wordSubtitle(word: SearchWordRow) {
  return [word.reading, word.primary_meaning].filter(Boolean).join(" · ");
}

function toWordSearchResult(word: SearchWordRow): SearchResultItem {
  return {
    type: "word",
    id: word.id,
    title: word.expression,
    subtitle: wordSubtitle(word),
    targetPaneKey: `word:${word.id}`,
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function appendSearchResults(
  items: SearchResultItem[],
  seen: Set<string>,
  candidates: SearchResultItem[],
) {
  for (const item of candidates) {
    const key = `${item.type}:${item.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(item);

    if (items.length >= 30) {
      return;
    }
  }
}

export function upsertSourceDeck(db: Db, input: SourceDeckInput) {
  db.prepare(`
    insert into source_decks (id, name, format, file_name, file_hash, imported_at)
    values (@id, @name, @format, @fileName, @fileHash, @importedAt)
    on conflict(id) do update set
      name = excluded.name,
      format = excluded.format,
      file_name = excluded.file_name,
      file_hash = excluded.file_hash,
      imported_at = excluded.imported_at
  `).run(input);
}

export function upsertSourceRecord(db: Db, input: SourceRecordInput) {
  db.prepare(`
    insert into source_records (id, source_deck_id, external_id, record_type, raw_json)
    values (@id, @sourceDeckId, @externalId, @recordType, @rawJson)
    on conflict(id) do update set
      source_deck_id = excluded.source_deck_id,
      external_id = excluded.external_id,
      record_type = excluded.record_type,
      raw_json = excluded.raw_json
  `).run(input);
}

export function upsertMediaAsset(db: Db, input: MediaAssetInput) {
  db.prepare(`
    insert into media_assets (
      id,
      source_deck_id,
      source_media_key,
      file_name,
      content_type,
      file_hash,
      storage_path
    )
    values (
      @id,
      @sourceDeckId,
      @sourceMediaKey,
      @fileName,
      @contentType,
      @fileHash,
      @storagePath
    )
    on conflict(id) do update set
      source_deck_id = excluded.source_deck_id,
      source_media_key = excluded.source_media_key,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      file_hash = excluded.file_hash,
      storage_path = excluded.storage_path
  `).run(input);
}

export function upsertKanji(db: Db, input: KanjiInput) {
  db.prepare(`
    insert into kanji (
      literal,
      primary_meaning,
      stroke_count,
      stroke_order_media_id,
      frequency_rank,
      usefulness,
      source_record_id,
      created_at,
      updated_at
    )
    values (
      @literal,
      @primaryMeaning,
      @strokeCount,
      @strokeOrderMediaId,
      @frequencyRank,
      @usefulness,
      @sourceRecordId,
      @now,
      @now
    )
    on conflict(literal) do update set
      primary_meaning = excluded.primary_meaning,
      stroke_count = excluded.stroke_count,
      stroke_order_media_id = excluded.stroke_order_media_id,
      frequency_rank = excluded.frequency_rank,
      usefulness = excluded.usefulness,
      source_record_id = excluded.source_record_id,
      updated_at = excluded.updated_at
  `).run(input);
}

export function insertKanjiStubIfMissing(db: Db, input: KanjiStubInput) {
  db.prepare(`
    insert into kanji (
      literal,
      primary_meaning,
      stroke_count,
      stroke_order_media_id,
      frequency_rank,
      usefulness,
      source_record_id,
      created_at,
      updated_at
    )
    values (
      @literal,
      @primaryMeaning,
      null,
      null,
      null,
      null,
      @sourceRecordId,
      @now,
      @now
    )
    on conflict(literal) do nothing
  `).run(input);
}

export function upsertWord(db: Db, input: WordInput) {
  db.prepare(`
    insert into words (
      id,
      expression,
      reading,
      primary_meaning,
      usefulness,
      created_at,
      updated_at
    )
    values (
      @id,
      @expression,
      @reading,
      @primaryMeaning,
      @usefulness,
      @now,
      @now
    )
    on conflict(id) do update set
      expression = excluded.expression,
      reading = excluded.reading,
      primary_meaning = excluded.primary_meaning,
      usefulness = excluded.usefulness,
      updated_at = excluded.updated_at
  `).run(input);
}

export function upsertWordMeaning(db: Db, input: WordMeaningInput) {
  db.prepare(`
    insert into word_meanings (id, word_id, meaning, position)
    values (@id, @wordId, @meaning, @position)
    on conflict(id) do update set
      word_id = excluded.word_id,
      meaning = excluded.meaning,
      position = excluded.position
  `).run(input);
}

export function replaceWordKanji(db: Db, wordId: string, links: WordKanjiInput[]) {
  const deleteExisting = db.prepare("delete from word_kanji where word_id = ?");
  const insertLink = db.prepare(`
    insert into word_kanji (word_id, kanji_literal, position)
    values (@wordId, @kanjiLiteral, @position)
  `);

  deleteExisting.run(wordId);

  for (const link of links) {
    insertLink.run(link);
  }
}

export function replaceKanjiReadings(
  db: Db,
  kanjiLiteral: string,
  sourceRecordId: string | null,
  readings: KanjiReadingInput[],
) {
  const deleteExisting = db.prepare(`
    delete from kanji_readings
    where kanji_literal = ?
      and (
        source_record_id = ?
        or (? is null and source_record_id is null)
      )
  `);
  const insertReading = db.prepare(`
    insert into kanji_readings (
      id,
      kanji_literal,
      reading_type,
      reading,
      meaning,
      usefulness,
      position,
      source_record_id
    )
    values (
      @id,
      @kanjiLiteral,
      @readingType,
      @reading,
      @meaning,
      @usefulness,
      @position,
      @sourceRecordId
    )
  `);

  deleteExisting.run(kanjiLiteral, sourceRecordId, sourceRecordId);

  for (const reading of readings) {
    insertReading.run(reading);
  }
}

export function getKanjiByLiteral(db: Db, literal: string): KanjiRow | null {
  const row = db
    .prepare(
      `
      select
        kanji.literal,
        kanji.primary_meaning,
        kanji.stroke_count,
        kanji.stroke_order_media_id,
        kanji.frequency_rank,
        kanji.usefulness,
        kanji.source_record_id,
        kanji.created_at,
        kanji.updated_at,
        media_assets.id as media_id,
        media_assets.source_deck_id as media_source_deck_id,
        media_assets.source_media_key as media_source_media_key,
        media_assets.file_name as media_file_name,
        media_assets.content_type as media_content_type,
        media_assets.file_hash as media_file_hash,
        media_assets.storage_path as media_storage_path
      from kanji
      left join media_assets on media_assets.id = kanji.stroke_order_media_id
      where kanji.literal = ?
      `,
    )
    .get(literal) as KanjiQueryRow | undefined;

  if (!row) {
    return null;
  }

  return {
    literal: row.literal,
    primaryMeaning: row.primary_meaning,
    strokeCount: row.stroke_count,
    strokeOrderMediaId: row.stroke_order_media_id,
    frequencyRank: row.frequency_rank,
    usefulness: row.usefulness,
    sourceRecordId: row.source_record_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    strokeOrderMedia: row.media_id
      ? {
          id: row.media_id,
          sourceDeckId: row.media_source_deck_id ?? "",
          sourceMediaKey: row.media_source_media_key ?? "",
          fileName: row.media_file_name ?? "",
          contentType: row.media_content_type,
          fileHash: row.media_file_hash,
          storagePath: row.media_storage_path ?? "",
        }
      : null,
  };
}

export function listKanji(db: Db, limit: number): KanjiListRow[] {
  return db
    .prepare(
      `
      select
        literal,
        primary_meaning,
        stroke_count,
        frequency_rank,
        usefulness
      from kanji
      order by
        case when frequency_rank is null then 1 else 0 end,
        frequency_rank,
        literal
      limit ?
      `,
    )
    .all(limit)
    .map((row) => {
      const kanji = row as {
        literal: string;
        primary_meaning: string;
        stroke_count: number | null;
        frequency_rank: number | null;
        usefulness: string | null;
      };

      return {
        literal: kanji.literal,
        meaning: kanji.primary_meaning,
        strokeCount: kanji.stroke_count,
        frequencyRank: kanji.frequency_rank,
        usefulness: kanji.usefulness,
      };
    });
}

export function searchLibrary(db: Db, rawQuery: string): SearchResultItem[] {
  const query = rawQuery.trim();

  if (query === "") {
    return [];
  }

  const escapedQuery = escapeLike(query);
  const items: SearchResultItem[] = [];
  const seen = new Set<string>();

  const exactKanji = db
    .prepare(
      `
      select literal, primary_meaning
      from kanji
      where literal = ?
      limit 10
      `,
    )
    .all(query)
    .map((row) => {
      const kanji = row as { literal: string; primary_meaning: string };

      return {
        type: "kanji",
        id: kanji.literal,
        title: kanji.literal,
        subtitle: kanji.primary_meaning,
        targetPaneKey: `kanji:${kanji.literal}`,
      } satisfies SearchResultItem;
    });
  appendSearchResults(items, seen, exactKanji);

  const exactWords = db
    .prepare(
      `
      select id, expression, reading, primary_meaning
      from words
      where expression = ?
      order by expression, reading
      limit 10
      `,
    )
    .all(query)
    .map((row) => toWordSearchResult(row as SearchWordRow));
  appendSearchResults(items, seen, exactWords);

  const expressionPrefixWords = db
    .prepare(
      `
      select id, expression, reading, primary_meaning
      from words
      where expression like ? escape '\\'
        and expression <> ?
      order by length(expression), expression
      limit 10
      `,
    )
    .all(`${escapedQuery}%`, query)
    .map((row) => toWordSearchResult(row as SearchWordRow));
  appendSearchResults(items, seen, expressionPrefixWords);

  const readingPrefixWords = db
    .prepare(
      `
      select id, expression, reading, primary_meaning
      from words
      where reading like ? escape '\\'
      order by expression
      limit 10
      `,
    )
    .all(`${escapedQuery}%`)
    .map((row) => toWordSearchResult(row as SearchWordRow));
  appendSearchResults(items, seen, readingPrefixWords);

  const englishMeaningWords = db
    .prepare(
      `
      select id, expression, reading, primary_meaning
      from words
      where primary_meaning like ? escape '\\'
      order by expression
      limit 10
      `,
    )
    .all(`%${escapedQuery}%`)
    .map((row) => toWordSearchResult(row as SearchWordRow));
  appendSearchResults(items, seen, englishMeaningWords);

  return items;
}

export function getKanjiReadings(db: Db, literal: string): KanjiReadingRow[] {
  return db
    .prepare(
      `
      select
        reading_type,
        reading,
        meaning,
        usefulness,
        position
      from kanji_readings
      where kanji_literal = ?
      order by
        case reading_type
          when 'on' then 0
          when 'kun' then 1
          else 2
        end,
        position,
        reading
      `,
    )
    .all(literal)
    .map((row) => {
      const reading = row as {
        reading_type: KanjiReadingType;
        reading: string;
        meaning: string | null;
        usefulness: string | null;
        position: number;
      };

      return {
        type: reading.reading_type,
        reading: reading.reading,
        meaning: reading.meaning,
        usefulness: reading.usefulness,
        position: reading.position,
      };
    });
}

export function getWordsForKanji(db: Db, literal: string): WordSummaryRow[] {
  return db
    .prepare(
      `
      select
        words.id,
        words.expression,
        words.reading,
        words.primary_meaning,
        words.usefulness,
        min(words.rowid) as word_order
      from word_kanji
      join words on words.id = word_kanji.word_id
      where word_kanji.kanji_literal = ?
      group by
        words.id,
        words.expression,
        words.reading,
        words.primary_meaning,
        words.usefulness
      order by word_order, words.expression
      `,
    )
    .all(literal)
    .map((row) => {
      const word = row as {
        id: string;
        expression: string;
        reading: string | null;
        primary_meaning: string | null;
        usefulness: string | null;
      };

      return {
        id: word.id,
        expression: word.expression,
        reading: word.reading,
        meaning: word.primary_meaning,
        usefulness: word.usefulness,
      };
    });
}

export function listWords(db: Db, limit: number): WordListRow[] {
  return db
    .prepare(
      `
      select
        id,
        expression,
        reading,
        primary_meaning,
        usefulness
      from words
      order by expression, reading
      limit ?
      `,
    )
    .all(limit)
    .map((row) => {
      const word = row as {
        id: string;
        expression: string;
        reading: string | null;
        primary_meaning: string | null;
        usefulness: string | null;
      };

      return {
        id: word.id,
        expression: word.expression,
        reading: word.reading,
        meaning: word.primary_meaning,
        usefulness: word.usefulness,
      };
    });
}

export function getWordById(db: Db, id: string): WordDetailRow | null {
  const word = db
    .prepare(
      `
      select
        id,
        expression,
        reading,
        primary_meaning,
        usefulness,
        created_at,
        updated_at
      from words
      where id = ?
      `,
    )
    .get(id) as
    | {
        id: string;
        expression: string;
        reading: string | null;
        primary_meaning: string | null;
        usefulness: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!word) {
    return null;
  }

  const meanings = db
    .prepare(
      `
      select id, meaning, position
      from word_meanings
      where word_id = ?
      order by position, meaning
      `,
    )
    .all(id)
    .map((row) => {
      const meaning = row as { id: string; meaning: string; position: number };

      return {
        id: meaning.id,
        meaning: meaning.meaning,
        position: meaning.position,
      };
    });

  const kanji = db
    .prepare(
      `
      select
        word_kanji.kanji_literal,
        kanji.primary_meaning,
        word_kanji.position
      from word_kanji
      join kanji on kanji.literal = word_kanji.kanji_literal
      where word_kanji.word_id = ?
      order by word_kanji.position, word_kanji.kanji_literal
      `,
    )
    .all(id)
    .map((row) => {
      const linkedKanji = row as {
        kanji_literal: string;
        primary_meaning: string | null;
        position: number;
      };

      return {
        literal: linkedKanji.kanji_literal,
        meaning: linkedKanji.primary_meaning,
        position: linkedKanji.position,
      };
    });

  return {
    id: word.id,
    expression: word.expression,
    reading: word.reading,
    primaryMeaning: word.primary_meaning,
    usefulness: word.usefulness,
    createdAt: word.created_at,
    updatedAt: word.updated_at,
    meanings,
    kanji,
  };
}

export function getMediaAssetById(db: Db, id: string): MediaAssetRow | null {
  const row = db
    .prepare(
      `
      select
        id,
        source_deck_id,
        source_media_key,
        file_name,
        content_type,
        file_hash,
        storage_path
      from media_assets
      where id = ?
      `,
    )
    .get(id) as
    | {
        id: string;
        source_deck_id: string;
        source_media_key: string;
        file_name: string;
        content_type: string | null;
        file_hash: string | null;
        storage_path: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sourceDeckId: row.source_deck_id,
    sourceMediaKey: row.source_media_key,
    fileName: row.file_name,
    contentType: row.content_type,
    fileHash: row.file_hash,
    storagePath: row.storage_path,
  };
}
