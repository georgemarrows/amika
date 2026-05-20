import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { reviewSrsCard, SrsReviewError } from "../srs/review-service.js";
import {
  disableKanjiSrs,
  enableKanjiSrs,
  getSrsCardById,
  getSrsCardsForKanji,
  listDueSrsCards,
  listSrsKanjiMatrixRows,
  openDatabase,
  runMigrations,
  updateSrsCardState,
  upsertKanji,
  type Db,
} from "./index.js";

const now = "2026-05-16T10:00:00.000Z";

function seedKanji(db: Db, literal = "具") {
  upsertKanji(db, {
    literal,
    primaryMeaning: literal === "具" ? "tool" : "sun, day",
    strokeCount: null,
    strokeOrderMediaId: null,
    frequencyRank: null,
    usefulness: null,
    sourceRecordId: null,
    now: "2026-05-15T10:00:00.000Z",
  });
}

describe("SRS repositories", () => {
  test("enables a kanji by creating two independent due cards", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      seedKanji(db);

      assert.deepEqual(
        enableKanjiSrs(db, "具", now).map((card) => ({
          kanjiLiteral: card.kanjiLiteral,
          cardKind: card.cardKind,
          enabled: card.enabled,
          state: card.state,
          dueAt: card.dueAt,
        })),
        [
          {
            kanjiLiteral: "具",
            cardKind: "kanji_production",
            enabled: true,
            state: "new",
            dueAt: now,
          },
          {
            kanjiLiteral: "具",
            cardKind: "kanji_recognition",
            enabled: true,
            state: "new",
            dueAt: now,
          },
        ],
      );
    } finally {
      db.close();
    }
  });

  test("lists due enabled cards while excluding disabled and future cards", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      seedKanji(db, "具");
      seedKanji(db, "日");
      const [production, recognition] = enableKanjiSrs(db, "具", "2026-05-16T09:00:00.000Z");
      const [futureProduction] = enableKanjiSrs(db, "日", "2026-05-17T10:00:00.000Z");

      updateSrsCardState(db, production.id, {
        state: "review",
        dueAt: "2026-05-16T09:00:00.000Z",
        intervalDays: 3,
        easeFactor: 2.5,
        reps: 1,
        lapses: 0,
        lastReviewedAt: "2026-05-13T09:00:00.000Z",
        updatedAt: now,
      });
      disableKanjiSrs(db, "日", now);

      assert.deepEqual(
        listDueSrsCards(db, now, 10).map((card) => card.id),
        [production.id, recognition.id],
      );
      assert.equal(getSrsCardById(db, futureProduction.id)?.enabled, false);
    } finally {
      db.close();
    }
  });

  test("disabling hides cards but preserves review history", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      seedKanji(db);
      const [card] = enableKanjiSrs(db, "具", now);

      reviewSrsCard(db, {
        cardId: card.id,
        rating: "good",
        reviewedAt: "2026-05-16T10:05:00.000Z",
      });
      disableKanjiSrs(db, "具", "2026-05-16T10:06:00.000Z");

      assert.deepEqual(listDueSrsCards(db, "2026-05-20T10:00:00.000Z", 10), []);
      assert.deepEqual(
        db.prepare("select count(*) as count from srs_reviews where card_id = ?").get(card.id),
        { count: 1 },
      );
    } finally {
      db.close();
    }
  });

  test("reviewing one card inserts one review and leaves its sibling independent", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      seedKanji(db);
      const [production, recognition] = enableKanjiSrs(db, "具", now);

      const result = reviewSrsCard(db, {
        cardId: recognition.id,
        rating: "easy",
        reviewedAt: "2026-05-16T10:05:00.000Z",
      });

      assert.match(result.review.id, /^srs-review-/);
      assert.equal(result.card.id, recognition.id);
      assert.equal(result.card.state, "review");
      assert.equal(result.card.intervalDays, 4);
      assert.deepEqual(
        db.prepare("select count(*) as count from srs_reviews").get(),
        { count: 1 },
      );
      assert.deepEqual(
        db.prepare("select count(*) as count from srs_cards").get(),
        { count: 2 },
      );
      assert.deepEqual(getSrsCardById(db, production.id), production);
    } finally {
      db.close();
    }
  });

  test("rejects missing, disabled, and unknown-scheduler review attempts", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      seedKanji(db);
      const [card] = enableKanjiSrs(db, "具", now);

      assert.throws(
        () => reviewSrsCard(db, { cardId: "missing", rating: "good", reviewedAt: now }),
        (error) => error instanceof SrsReviewError && error.code === "card_not_found",
      );

      disableKanjiSrs(db, "具", now);
      assert.throws(
        () => reviewSrsCard(db, { cardId: card.id, rating: "good", reviewedAt: now }),
        (error) => error instanceof SrsReviewError && error.code === "card_disabled",
      );

      enableKanjiSrs(db, "具", now);
      db.prepare("update srs_cards set scheduler_version = 'unknown' where id = ?").run(card.id);
      assert.throws(
        () => reviewSrsCard(db, { cardId: card.id, rating: "good", reviewedAt: now }),
        (error) => error instanceof SrsReviewError && error.code === "unknown_scheduler",
      );
    } finally {
      db.close();
    }
  });

  test("reads all cards for a kanji", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      seedKanji(db);
      enableKanjiSrs(db, "具", now);

      assert.deepEqual(
        getSrsCardsForKanji(db, "具").map((card) => card.cardKind),
        ["kanji_production", "kanji_recognition"],
      );
    } finally {
      db.close();
    }
  });

  test("lists grouped SRS matrix rows with disabled cards sorted last", () => {
    const db = openDatabase({ path: ":memory:" });

    try {
      runMigrations(db);
      seedKanji(db, "具");
      seedKanji(db, "日");
      seedKanji(db, "忘");
      seedKanji(db, "未");
      const [futureProduction, futureRecognition] = enableKanjiSrs(db, "具", "2026-05-20T10:00:00.000Z");
      const [dueProduction, dueRecognition] = enableKanjiSrs(db, "日", "2026-05-16T08:00:00.000Z");
      const [disabledProduction, disabledRecognition] = enableKanjiSrs(db, "忘", "2026-05-16T07:00:00.000Z");

      updateSrsCardState(db, dueProduction.id, {
        state: "review",
        dueAt: "2026-05-16T08:00:00.000Z",
        intervalDays: 3,
        easeFactor: 2.5,
        reps: 4,
        lapses: 1,
        lastReviewedAt: "2026-05-13T08:00:00.000Z",
        updatedAt: now,
      });
      updateSrsCardState(db, dueRecognition.id, {
        state: "review",
        dueAt: "2026-05-17T08:00:00.000Z",
        intervalDays: 4,
        easeFactor: 2.5,
        reps: 6,
        lapses: 2,
        lastReviewedAt: "2026-05-13T08:00:00.000Z",
        updatedAt: now,
      });
      updateSrsCardState(db, futureProduction.id, {
        state: "review",
        dueAt: "2026-05-21T08:00:00.000Z",
        intervalDays: 5,
        easeFactor: 2.5,
        reps: 8,
        lapses: 0,
        lastReviewedAt: "2026-05-13T08:00:00.000Z",
        updatedAt: now,
      });
      updateSrsCardState(db, futureRecognition.id, {
        state: "review",
        dueAt: "2026-05-20T08:00:00.000Z",
        intervalDays: 5,
        easeFactor: 2.5,
        reps: 7,
        lapses: 1,
        lastReviewedAt: "2026-05-13T08:00:00.000Z",
        updatedAt: now,
      });
      updateSrsCardState(db, disabledProduction.id, {
        state: "new",
        dueAt: "2026-05-16T07:00:00.000Z",
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 1,
        lapses: 0,
        lastReviewedAt: "2026-05-13T08:00:00.000Z",
        updatedAt: now,
      });
      updateSrsCardState(db, disabledRecognition.id, {
        state: "new",
        dueAt: "2026-05-16T07:30:00.000Z",
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 2,
        lapses: 0,
        lastReviewedAt: "2026-05-13T08:00:00.000Z",
        updatedAt: now,
      });
      disableKanjiSrs(db, "忘", now);

      const rows = listSrsKanjiMatrixRows(db, now);

      assert.deepEqual(
        rows.map((row) => ({
          literal: row.kanjiLiteral,
          nextDueAt: row.nextDueAt,
          recognitionKind: row.recognition?.cardKind,
          productionKind: row.production?.cardKind,
          totalReps: row.totalReps,
          totalLapses: row.totalLapses,
        })),
        [
          {
            literal: "日",
            nextDueAt: "2026-05-16T08:00:00.000Z",
            recognitionKind: "kanji_recognition",
            productionKind: "kanji_production",
            totalReps: 10,
            totalLapses: 3,
          },
          {
            literal: "具",
            nextDueAt: "2026-05-20T08:00:00.000Z",
            recognitionKind: "kanji_recognition",
            productionKind: "kanji_production",
            totalReps: 15,
            totalLapses: 1,
          },
          {
            literal: "忘",
            nextDueAt: null,
            recognitionKind: "kanji_recognition",
            productionKind: "kanji_production",
            totalReps: 3,
            totalLapses: 0,
          },
        ],
      );
    } finally {
      db.close();
    }
  });
});
