import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getKanjiByLiteral,
  openDatabase,
  runMigrations,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
} from "./index.js";

describe("database migrations", () => {
  test("applies the initial kanji schema once", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      const first = runMigrations(db);
      const second = runMigrations(db);
      const table = db
        .prepare("select name from sqlite_master where type = 'table' and name = 'kanji'")
        .get();

      assert.deepEqual(first.applied, ["001_initial_kanji.sql"]);
      assert.deepEqual(second.applied, []);
      assert.ok(table);
    } finally {
      db.close();
    }
  });
});

describe("kanji repository", () => {
  test("upserts and reads a kanji with linked stroke media", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      upsertSourceDeck(db, {
        id: "deck",
        name: "Deck",
        format: "apkg",
        fileName: "deck.apkg",
        fileHash: "hash",
        importedAt: "2026-05-05T00:00:00.000Z",
      });
      upsertSourceRecord(db, {
        id: "record",
        sourceDeckId: "deck",
        externalId: "1439130130915",
        recordType: "kanji_damage_note",
        rawJson: "{}",
      });
      upsertMediaAsset(db, {
        id: "media",
        sourceDeckId: "deck",
        sourceMediaKey: "570",
        fileName: "e585b7.png",
        contentType: "image/png",
        fileHash: "media-hash",
        storagePath: ".var/media/kanji-damage/media-hash.png",
      });
      upsertKanji(db, {
        literal: "具",
        primaryMeaning: "tool",
        strokeCount: 8,
        strokeOrderMediaId: "media",
        frequencyRank: 683,
        usefulness: "★★★★☆",
        sourceRecordId: "record",
        now: "2026-05-05T00:00:00.000Z",
      });

      const kanji = getKanjiByLiteral(db, "具");

      assert.equal(kanji?.primaryMeaning, "tool");
      assert.equal(kanji?.strokeCount, 8);
      assert.equal(kanji?.frequencyRank, 683);
      assert.equal(kanji?.strokeOrderMedia?.fileName, "e585b7.png");
    } finally {
      db.close();
    }
  });

  test("creates the parent directory for file databases", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-db-test-"));
    const dbPath = join(tempDir, "nested", "amika.sqlite");
    const db = openDatabase({ path: dbPath });

    try {
      runMigrations(db);
      assert.deepEqual(
        db.prepare("select count(*) as count from schema_migrations").get() as { count: number },
        { count: 1 },
      );
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
