import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import DatabaseConstructor from "better-sqlite3";

import { openDatabase } from "../server/src/db/index.js";
import { importAnkiSrsKanji } from "./import-anki-srs-kanji.js";

const fieldSeparator = "\x1f";
const collectionCreatedAt = 1_000_000_000;

function reviewDueAt(day: number) {
  return new Date((collectionCreatedAt + day * 24 * 60 * 60) * 1000).toISOString();
}

function createAnkiFixture(collectionPath: string) {
  const db = new DatabaseConstructor(collectionPath);

  try {
    db.exec(`
      create table col (
        crt integer not null
      );

      create table decks (
        id integer primary key,
        name text not null
      );

      create table fields (
        ntid integer not null,
        ord integer not null,
        name text not null,
        primary key (ntid, ord)
      );

      create table templates (
        ntid integer not null,
        ord integer not null,
        name text not null,
        primary key (ntid, ord)
      );

      create table notes (
        id integer primary key,
        mid integer not null,
        flds text not null
      );

      create table cards (
        id integer primary key,
        nid integer not null,
        did integer not null,
        ord integer not null,
        type integer not null,
        queue integer not null,
        due integer not null,
        ivl integer not null,
        factor integer not null,
        reps integer not null,
        lapses integer not null,
        left integer not null,
        odue integer not null,
        odid integer not null
      );
    `);
    db.prepare("insert into col (crt) values (?)").run(collectionCreatedAt);
    db.prepare("insert into decks (id, name) values (?, ?)").run(1735059724848, `_Work${fieldSeparator}KLC`);

    db.prepare("insert into fields (ntid, ord, name) values (?, ?, ?)").run(1414923096984, 0, "Kanji");
    db.prepare("insert into fields (ntid, ord, name) values (?, ?, ?)").run(1414923096984, 1, "Meaning");
    db.prepare("insert into fields (ntid, ord, name) values (?, ?, ?)").run(1414923096984, 2, "Onyomi");
    db.prepare("insert into templates (ntid, ord, name) values (?, ?, ?)").run(1414923096984, 0, "Write");
    db.prepare("insert into templates (ntid, ord, name) values (?, ?, ?)").run(1414923096984, 1, "Read");

    db.prepare("insert into fields (ntid, ord, name) values (?, ?, ?)").run(2, 0, "Front");
    db.prepare("insert into fields (ntid, ord, name) values (?, ?, ?)").run(2, 1, "Back");
    db.prepare("insert into templates (ntid, ord, name) values (?, ?, ?)").run(2, 0, "Card 1");

    db.prepare("insert into notes (id, mid, flds) values (?, ?, ?)").run(
      200,
      1414923096984,
      ["具", "tool", "GU"].join(fieldSeparator),
    );
    db.prepare("insert into notes (id, mid, flds) values (?, ?, ?)").run(
      201,
      1414923096984,
      ["日", "sun, day", "NICHI"].join(fieldSeparator),
    );
    db.prepare("insert into notes (id, mid, flds) values (?, ?, ?)").run(300, 2, ["front", "back"].join(fieldSeparator));

    const insertCard = db.prepare(`
      insert into cards (
        id,
        nid,
        did,
        ord,
        type,
        queue,
        due,
        ivl,
        factor,
        reps,
        lapses,
        left,
        odue,
        odid
      )
      values (?, ?, 1735059724848, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
    `);
    insertCard.run(100, 200, 0, 0, 0, 12, 0, 0, 0, 0);
    insertCard.run(101, 200, 1, 2, 2, 3, 7, 2500, 5, 1);
    insertCard.run(102, 300, 0, 0, 0, 1, 0, 0, 0, 0);
    insertCard.run(103, 200, 0, 2, -2, 4, 4, 2200, 3, 0);
    insertCard.run(104, 201, 0, 2, -1, 5, 9, 2300, 2, 0);
  } finally {
    db.close();
  }
}

describe("Anki kanji SRS importer", () => {
  test("dry-runs KanjiDamage card mapping and reports skipped cards", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-anki-srs-test-"));
    const collectionPath = join(tempDir, "collection.anki2");

    try {
      createAnkiFixture(collectionPath);

      const summary = await importAnkiSrsKanji({
        collectionPath,
        dbPath: join(tempDir, "amika.sqlite"),
        now: "2026-05-16T10:00:00.000Z",
      });

      assert.equal(summary.mode, "dry-run");
      assert.equal(summary.deck.displayName, "_Work / KLC");
      assert.deepEqual(summary.ankiCounts, {
        total: 5,
        new: 2,
        learning: 0,
        review: 1,
        suspended: 1,
        skipped: 2,
      });
      assert.equal(summary.proposedCount, 3);
      assert.equal(summary.importedCount, 0);
      assert.deepEqual(
        summary.skippedCards.map((card) => card.reason),
        ["non_kanji_damage", "unsupported_queue"],
      );
      assert.deepEqual(
        summary.proposedCards.map((card) => ({
          sourceCardId: card.sourceCardId,
          kanjiLiteral: card.kanjiLiteral,
          cardKind: card.cardKind,
          enabled: card.enabled,
          state: card.state,
          dueAt: card.dueAt,
          intervalDays: card.intervalDays,
          easeFactor: card.easeFactor,
          reps: card.reps,
          lapses: card.lapses,
        })),
        [
          {
            sourceCardId: "100",
            kanjiLiteral: "具",
            cardKind: "kanji_production",
            enabled: true,
            state: "new",
            dueAt: "2026-05-16T10:00:00.000Z",
            intervalDays: 0,
            easeFactor: 2.5,
            reps: 0,
            lapses: 0,
          },
          {
            sourceCardId: "101",
            kanjiLiteral: "具",
            cardKind: "kanji_recognition",
            enabled: true,
            state: "review",
            dueAt: reviewDueAt(3),
            intervalDays: 7,
            easeFactor: 2.5,
            reps: 5,
            lapses: 1,
          },
          {
            sourceCardId: "104",
            kanjiLiteral: "日",
            cardKind: "kanji_production",
            enabled: false,
            state: "review",
            dueAt: reviewDueAt(5),
            intervalDays: 9,
            easeFactor: 2.3,
            reps: 2,
            lapses: 0,
          },
        ],
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("refuses to read an active Anki profile with a WAL file", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-anki-srs-active-test-"));
    const collectionPath = join(tempDir, "collection.anki2");

    try {
      createAnkiFixture(collectionPath);
      writeFileSync(`${collectionPath}-wal`, "pending wal frames");

      await assert.rejects(
        () => importAnkiSrsKanji({ collectionPath, dbPath: join(tempDir, "amika.sqlite") }),
        /Refusing to import from active Anki profile/,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("applies and replaces imported SRS state with provenance", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "amika-anki-srs-apply-test-"));
    const collectionPath = join(tempDir, "collection.anki2");
    const dbPath = join(tempDir, "amika.sqlite");

    try {
      createAnkiFixture(collectionPath);

      const first = await importAnkiSrsKanji({
        collectionPath,
        dbPath,
        apply: true,
        now: "2026-05-16T10:00:00.000Z",
        backupDir: join(tempDir, "backups"),
      });
      const ankiDb = new DatabaseConstructor(collectionPath);

      try {
        ankiDb.prepare("update cards set due = 5, ivl = 11, factor = 2600, reps = 6 where id = 101").run();
      } finally {
        ankiDb.close();
      }

      const second = await importAnkiSrsKanji({
        collectionPath,
        dbPath,
        apply: true,
        now: "2026-05-17T10:00:00.000Z",
        backupDir: join(tempDir, "backups"),
      });
      const appDb = openDatabase({ path: dbPath, readonly: true, fileMustExist: true });

      try {
        const recognition = appDb
          .prepare(
            `
            select
              srs_cards.kanji_literal,
              srs_cards.card_kind,
              srs_cards.enabled,
              srs_cards.state,
              srs_cards.due_at,
              srs_cards.interval_days,
              srs_cards.ease_factor,
              srs_cards.reps,
              srs_cards.lapses,
              srs_import_links.source,
              srs_import_links.source_card_id,
              srs_import_links.source_template_name
            from srs_cards
            join srs_import_links on srs_import_links.card_id = srs_cards.id
            where srs_cards.kanji_literal = '具'
              and srs_cards.card_kind = 'kanji_recognition'
            `,
          )
          .get() as {
          kanji_literal: string;
          card_kind: string;
          enabled: number;
          state: string;
          due_at: string;
          interval_days: number;
          ease_factor: number;
          reps: number;
          lapses: number;
          source: string;
          source_card_id: string;
          source_template_name: string;
        };

        assert.equal(first.importedCount, 3);
        assert.equal(first.backupPath, null);
        assert.equal(second.importedCount, 3);
        assert.ok(second.backupPath);
        assert.equal(existsSync(second.backupPath), true);
        assert.deepEqual(appDb.prepare("select count(*) as count from srs_cards").get(), { count: 3 });
        assert.deepEqual(appDb.prepare("select count(*) as count from srs_import_links").get(), { count: 3 });
        assert.deepEqual(appDb.prepare("select count(*) as count from kanji").get(), { count: 2 });
        assert.deepEqual(recognition, {
          kanji_literal: "具",
          card_kind: "kanji_recognition",
          enabled: 1,
          state: "review",
          due_at: reviewDueAt(5),
          interval_days: 11,
          ease_factor: 2.6,
          reps: 6,
          lapses: 1,
          source: "anki",
          source_card_id: "101",
          source_template_name: "Read",
        });
      } finally {
        appDb.close();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
