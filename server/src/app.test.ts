import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Readable } from "node:stream";

import { createApp } from "./app.js";
import { createHttpServer, createWebRequestFromIncomingMessage } from "./http.js";
import {
  type Db,
  enableKanjiSrs,
  getWordById,
  insertKanjiStubIfMissing,
  openDatabase,
  replaceKanjiReadings,
  replaceWordKanji,
  runMigrations,
  upsertKanji,
  upsertMediaAsset,
  upsertSourceDeck,
  upsertSourceRecord,
  upsertWord,
  upsertWordMeaning,
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
  replaceKanjiReadings(db, "具", "record", [
    {
      id: "reading-gu",
      kanjiLiteral: "具",
      readingType: "on",
      reading: "GU",
      meaning: null,
      usefulness: null,
      position: 0,
      sourceRecordId: "record",
    },
  ]);
}

function seedWordDetail(db: Db) {
  insertKanjiStubIfMissing(db, {
    literal: "道",
    primaryMeaning: "street",
    sourceRecordId: "record",
    now: "2026-05-05T00:00:00.000Z",
  });
  upsertWord(db, {
    id: "word-dogu",
    expression: "道具",
    reading: "どうぐ",
    primaryMeaning: "tool",
    usefulness: "★★★★☆",
    now: "2026-05-05T00:00:00.000Z",
  });
  upsertWordMeaning(db, {
    id: "word-dogu-meaning-tool",
    wordId: "word-dogu",
    meaning: "tool",
    position: 0,
  });
  replaceWordKanji(db, "word-dogu", [
    { wordId: "word-dogu", kanjiLiteral: "道", position: 0 },
    { wordId: "word-dogu", kanjiLiteral: "具", position: 1 },
  ]);
}

function seedSrsReviewData(db: Db, mediaRoot: string) {
  seedKanjiDetail(db, mediaRoot);
  seedWordDetail(db);
  return enableKanjiSrs(db, "具", "2026-05-16T10:00:00.000Z");
}

function seedSearchData(db: Db) {
  runMigrations(db);
  upsertKanji(db, {
    literal: "勉",
    primaryMeaning: "try hard",
    strokeCount: null,
    strokeOrderMediaId: null,
    frequencyRank: null,
    usefulness: null,
    sourceRecordId: null,
    now: "2026-05-12T00:00:00.000Z",
  });
  upsertWord(db, {
    id: "word-benkyou",
    expression: "勉強",
    reading: "べんきょう",
    primaryMeaning: "study",
    usefulness: null,
    now: "2026-05-12T00:00:00.000Z",
  });
}

function createJsonIncomingMessage(pathname: string, body: unknown): IncomingMessage {
  const jsonBody = JSON.stringify(body);
  const req = Readable.from([jsonBody]) as IncomingMessage;

  req.method = "POST";
  req.url = pathname;
  req.headers = {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(jsonBody)),
  };

  return req;
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
    assert.equal(body.review.dueCount, 0);
    assert.equal(body.latestSource.title, "Lesson 12");
  });

  test("returns first kanji detail data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      seedWordDetail(db);
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
        readings: [
          {
            type: "on",
            reading: "GU",
            meaning: null,
            usefulness: null,
          },
        ],
        srs: {
          enabled: false,
          dueCount: 0,
          cards: [],
        },
        mnemonics: [],
        words: [
          {
            id: "word-dogu",
            expression: "道具",
            reading: "どうぐ",
            meaning: "tool",
            usefulness: "★★★★☆",
          },
        ],
        relations: [],
      });
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns the first kanji list rows", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-kanji-list-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(new Request("http://localhost/api/kanji"));

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [
          {
            literal: "具",
            meaning: "tool",
            strokeCount: 8,
            frequencyRank: 683,
            usefulness: "★★★★☆",
          },
        ],
      });
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns ranked search results", async () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      seedSearchData(db);
      const app = createApp({ db });
      const response = await app(new Request("http://localhost/api/search?q=%E5%8B%89"));

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        query: "勉",
        items: [
          {
            type: "kanji",
            id: "勉",
            title: "勉",
            subtitle: "try hard",
            targetPaneKey: "kanji:勉",
          },
          {
            type: "word",
            id: "word-benkyou",
            title: "勉強",
            subtitle: "べんきょう · study",
            targetPaneKey: "word:word-benkyou",
          },
        ],
      });
    } finally {
      db.close();
    }
  });

  test("returns no search results for missing or empty queries", async () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      const app = createApp({ db });
      const missingResponse = await app(new Request("http://localhost/api/search"));
      const emptyResponse = await app(new Request("http://localhost/api/search?q=%20%20"));

      assert.equal(missingResponse.status, 200);
      assert.deepEqual(await missingResponse.json(), { query: "", items: [] });
      assert.equal(emptyResponse.status, 200);
      assert.deepEqual(await emptyResponse.json(), { query: "  ", items: [] });
    } finally {
      db.close();
    }
  });

  test("returns the next due SRS review card with display data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-srs-review-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedSrsReviewData(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(new Request("http://localhost/api/srs/review"));
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.dueCount, 2);
      assert.equal(body.card.kanjiLiteral, "具");
      assert.equal(body.card.meaning, "tool");
      assert.equal(body.card.cardKind, "kanji_production");
      assert.deepEqual(body.card.readings, [
        {
          type: "on",
          reading: "GU",
          meaning: null,
          usefulness: null,
        },
      ]);
      assert.deepEqual(body.card.words, [
        {
          id: "word-dogu",
          expression: "道具",
          reading: "どうぐ",
          meaning: "tool",
          usefulness: "★★★★☆",
        },
      ]);
      assert.match(body.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns an empty SRS queue when no cards are due", async () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      const app = createApp({ db });
      const response = await app(new Request("http://localhost/api/srs/review"));
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.dueCount, 0);
      assert.equal(body.card, null);
      assert.match(body.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    } finally {
      db.close();
    }
  });

  test("returns SRS kanji matrix rows with card status", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-srs-matrix-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedSrsReviewData(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(new Request("http://localhost/api/srs/cards/matrix"));
      const body = await response.json();
      const [item] = body.items;

      assert.equal(response.status, 200);
      assert.match(body.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(body.items.length, 1);
      assert.equal(item.kanjiLiteral, "具");
      assert.equal(item.meaning, "tool");
      assert.equal(item.nextDueAt, "2026-05-16T10:00:00.000Z");
      assert.equal(item.nextDueStatus, "overdue");
      assert.deepEqual(
        { ...item.recognition, id: "stable-card-id" },
        {
          id: "stable-card-id",
          kanjiLiteral: "具",
          cardKind: "kanji_recognition",
          enabled: true,
          schedulerVersion: "simple_sm2_v1",
          state: "new",
          dueAt: "2026-05-16T10:00:00.000Z",
          intervalDays: 0,
          easeFactor: 2.5,
          reps: 0,
          lapses: 0,
          lastReviewedAt: null,
        },
      );
      assert.deepEqual(
        { ...item.production, id: "stable-card-id" },
        {
          id: "stable-card-id",
          kanjiLiteral: "具",
          cardKind: "kanji_production",
          enabled: true,
          schedulerVersion: "simple_sm2_v1",
          state: "new",
          dueAt: "2026-05-16T10:00:00.000Z",
          intervalDays: 0,
          easeFactor: 2.5,
          reps: 0,
          lapses: 0,
          lastReviewedAt: null,
        },
      );
      assert.equal(item.totalReps, 0);
      assert.equal(item.totalLapses, 0);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns an empty SRS kanji matrix when no cards exist", async () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      const app = createApp({ db });
      const response = await app(new Request("http://localhost/api/srs/cards/matrix"));
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body.items, []);
      assert.match(body.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    } finally {
      db.close();
    }
  });

  test("submits an SRS review and returns the next card", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-srs-submit-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      const [card] = seedSrsReviewData(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(
        new Request("http://localhost/api/srs/reviews", {
          method: "POST",
          body: JSON.stringify({ cardId: card.id, rating: "good" }),
          headers: { "content-type": "application/json" },
        }),
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.reviewedCardId, card.id);
      assert.equal(body.dueCount, 1);
      assert.equal(body.nextCard.cardKind, "kanji_recognition");
      assert.deepEqual(db.prepare("select count(*) as count from srs_reviews").get(), { count: 1 });
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns typed SRS review request errors", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-srs-error-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      const [card] = seedSrsReviewData(db, tempDir);
      db.prepare("update srs_cards set enabled = 0 where id = ?").run(card.id);
      const app = createApp({ db });
      const invalidResponse = await app(
        new Request("http://localhost/api/srs/reviews", {
          method: "POST",
          body: JSON.stringify({ cardId: card.id, rating: "medium" }),
          headers: { "content-type": "application/json" },
        }),
      );
      const missingResponse = await app(
        new Request("http://localhost/api/srs/reviews", {
          method: "POST",
          body: JSON.stringify({ cardId: "missing", rating: "good" }),
          headers: { "content-type": "application/json" },
        }),
      );
      const disabledResponse = await app(
        new Request("http://localhost/api/srs/reviews", {
          method: "POST",
          body: JSON.stringify({ cardId: card.id, rating: "good" }),
          headers: { "content-type": "application/json" },
        }),
      );

      assert.equal(invalidResponse.status, 400);
      assert.deepEqual(await invalidResponse.json(), {
        error: "invalid_request",
        message: "Expected cardId and rating again/hard/good/easy",
      });
      assert.equal(missingResponse.status, 404);
      assert.equal((await missingResponse.json()).error, "srs_card_not_found");
      assert.equal(disabledResponse.status, 409);
      assert.equal((await disabledResponse.json()).error, "srs_card_disabled");
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("toggles kanji SRS status without deleting review history", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-kanji-srs-toggle-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const enableResponse = await app(
        new Request("http://localhost/api/kanji/%E5%85%B7/srs", {
          method: "POST",
          body: JSON.stringify({ enabled: true }),
          headers: { "content-type": "application/json" },
        }),
      );
      const enableBody = await enableResponse.json();
      const cardId = enableBody.cards[0].id;
      await app(
        new Request("http://localhost/api/srs/reviews", {
          method: "POST",
          body: JSON.stringify({ cardId, rating: "again" }),
          headers: { "content-type": "application/json" },
        }),
      );
      const disableResponse = await app(
        new Request("http://localhost/api/kanji/%E5%85%B7/srs", {
          method: "POST",
          body: JSON.stringify({ enabled: false }),
          headers: { "content-type": "application/json" },
        }),
      );
      const disableBody = await disableResponse.json();

      assert.equal(enableResponse.status, 200);
      assert.equal(enableBody.enabled, true);
      assert.equal(enableBody.cards.length, 2);
      assert.equal(disableResponse.status, 200);
      assert.equal(disableBody.enabled, false);
      assert.deepEqual(db.prepare("select count(*) as count from srs_reviews").get(), { count: 1 });
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("runs pending migrations when creating the HTTP server", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-kanji-srs-migrate-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      db.exec(`
        drop table srs_import_links;
        drop table srs_reviews;
        drop table srs_cards;
        delete from schema_migrations where id = '004_srs.sql';
      `);
      createHttpServer({ db, mediaRoot: tempDir });
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(
        new Request("http://localhost/api/kanji/%E5%85%B7/srs", {
          method: "POST",
          body: JSON.stringify({ enabled: true }),
          headers: { "content-type": "application/json" },
        }),
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.enabled, true);
      assert.equal(body.cards.length, 2);
      assert.deepEqual(db.prepare("select count(*) as count from srs_cards").get(), { count: 2 });
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("forwards JSON POST bodies through the HTTP request adapter", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-http-post-body-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      const app = createApp({ db, mediaRoot: tempDir });
      const request = await createWebRequestFromIncomingMessage(
        createJsonIncomingMessage("/api/kanji/%E5%85%B7/srs", { enabled: true }),
        "http://localhost",
      );
      const response = await app(request);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.enabled, true);
      assert.equal(body.cards.length, 2);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns word detail data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-word-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      seedWordDetail(db);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(new Request("http://localhost/api/words/word-dogu"));

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        id: "word-dogu",
        expression: "道具",
        reading: "どうぐ",
        primaryMeaning: "tool",
        usefulness: "★★★★☆",
        meanings: ["tool"],
        kanji: [
          { literal: "道", meaning: "street" },
          { literal: "具", meaning: "tool" },
        ],
      });
      assert.ok(getWordById(db, "word-dogu"));
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns the first word list rows", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-word-list-app-test-"));
    const db = openDatabase({ path: ":memory:" });

    try {
      seedKanjiDetail(db, tempDir);
      seedWordDetail(db);
      const app = createApp({ db, mediaRoot: tempDir });
      const response = await app(new Request("http://localhost/api/words"));

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        items: [
          {
            id: "word-dogu",
            expression: "道具",
            reading: "どうぐ",
            meaning: "tool",
            usefulness: "★★★★☆",
          },
        ],
      });
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns not found for missing words", async () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      const app = createApp({ db });
      const response = await app(new Request("http://localhost/api/words/missing"));

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Word not found" });
    } finally {
      db.close();
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

  test("rejects unsupported methods on known GET API routes", async () => {
    const db = openDatabase({ path: ":memory:" });
    const app = createApp({ db });

    try {
      const healthResponse = await app(new Request("http://localhost/api/health", { method: "POST" }));
      const homeResponse = await app(new Request("http://localhost/api/home", { method: "POST" }));
      const kanjiResponse = await app(new Request("http://localhost/api/kanji/%E5%85%B7", { method: "POST" }));
      const wordResponse = await app(new Request("http://localhost/api/words/word-dogu", { method: "POST" }));
      const mediaResponse = await app(new Request("http://localhost/api/media/media", { method: "POST" }));
      const searchResponse = await app(new Request("http://localhost/api/search?q=%E5%8B%89", { method: "POST" }));

      assert.equal(healthResponse.status, 405);
      assert.equal(healthResponse.headers.get("allow"), "GET, HEAD");
      assert.equal(await healthResponse.text(), "Method not allowed");
      assert.equal(homeResponse.status, 405);
      assert.equal(homeResponse.headers.get("allow"), "GET, HEAD");
      assert.equal(kanjiResponse.status, 405);
      assert.equal(kanjiResponse.headers.get("allow"), "GET, HEAD");
      assert.equal(wordResponse.status, 405);
      assert.equal(wordResponse.headers.get("allow"), "GET, HEAD");
      assert.equal(mediaResponse.status, 405);
      assert.equal(mediaResponse.headers.get("allow"), "GET, HEAD");
      assert.equal(searchResponse.status, 405);
      assert.equal(searchResponse.headers.get("allow"), "GET, HEAD");
    } finally {
      db.close();
    }
  });

  test("returns JSON not found for unknown API routes on any method", async () => {
    const app = createApp();
    const getResponse = await app(new Request("http://localhost/api/missing"));
    const postResponse = await app(new Request("http://localhost/api/missing", { method: "POST" }));

    assert.equal(getResponse.status, 404);
    assert.deepEqual(await getResponse.json(), { error: "Not found" });
    assert.equal(postResponse.status, 404);
    assert.deepEqual(await postResponse.json(), { error: "Not found" });
  });

  test("does not match nested paths as dynamic API ids", async () => {
    const app = createApp();
    const response = await app(new Request("http://localhost/api/words/a/b"));

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found" });
  });
});
