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
