import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createApp } from "./app.js";
import {
  type Db,
  openDatabase,
  runMigrations,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
} from "./db/index.js";

function seedKanjiDetail(db: Db, mediaRoot: string) {
  const mediaPath = join(mediaRoot, "stroke.png");

  runMigrations(db);
  writeFileSync(mediaPath, new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  upsertSourceDeck(db, {
    id: "deck",
    name: "Kanji Damage",
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
    fileName: "stroke.png",
    contentType: "image/png",
    fileHash: "media-hash",
    storagePath: mediaPath,
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
}

describe("server app", () => {
  test("reports health", async () => {
    const app = createApp();
    const response = await app(new Request("http://localhost/api/health"));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  test("returns home page data", async () => {
    const app = createApp();
    const response = await app(new Request("http://localhost/api/home"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.review.dueCount, 12);
    assert.equal(body.latestSource.title, "Lesson 12");
  });

  test("returns first kanji detail data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(new Request("http://localhost/api/kanji/%E5%85%B7"));
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        literal: "具",
        meaning: "tool",
        strokeCount: 8,
        frequencyRank: 683,
        usefulness: "★★★★☆",
        strokeOrderImage: {
          id: "media",
          url: "/api/media/media",
          contentType: "image/png",
        },
        components: [],
        readings: [],
        mnemonics: [],
        words: [],
        relations: [],
      });
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns not found for missing kanji", async () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      const app = createApp({ db });
      const response = await app(new Request("http://localhost/api/kanji/%E7%BE%8E"));

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Kanji not found" });
    } finally {
      db.close();
    }
  });

  test("serves imported media bytes", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-media-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(new Request("http://localhost/api/media/media"));
      const bytes = new Uint8Array(await response.arrayBuffer());

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.deepEqual([...bytes], [0x89, 0x50, 0x4e, 0x47]);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("rejects unsupported kanji and media methods", async () => {
    const db = openDatabase({ path: ":memory:" });
    const app = createApp({ db });

    try {
      const kanjiResponse = await app(new Request("http://localhost/api/kanji/%E5%85%B7", { method: "POST" }));
      const mediaResponse = await app(new Request("http://localhost/api/media/media", { method: "POST" }));

      assert.equal(kanjiResponse.status, 405);
      assert.equal(kanjiResponse.headers.get("allow"), "GET, HEAD");
      assert.equal(mediaResponse.status, 405);
      assert.equal(mediaResponse.headers.get("allow"), "GET, HEAD");
    } finally {
      db.close();
    }
  });
});
