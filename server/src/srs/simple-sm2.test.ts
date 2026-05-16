import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { scheduleSimpleSm2 } from "./simple-sm2.js";
import type { SrsCard, SrsCardState, SrsReviewRating } from "./types.js";

const reviewedAt = "2026-05-16T10:00:00.000Z";

function baseCard(state: SrsCardState, overrides: Partial<SrsCard> = {}): SrsCard {
  return {
    id: "card",
    kanjiLiteral: "具",
    cardKind: "kanji_recognition",
    enabled: true,
    schedulerVersion: "simple_sm2_v1",
    state,
    dueAt: "2026-05-16T09:00:00.000Z",
    intervalDays: 0,
    easeFactor: 2.5,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    createdAt: "2026-05-15T10:00:00.000Z",
    updatedAt: "2026-05-15T10:00:00.000Z",
    ...overrides,
  };
}

function scheduledState(card: SrsCard, rating: SrsReviewRating) {
  return scheduleSimpleSm2({ card, rating, reviewedAt }).nextCardState;
}

describe("simple_sm2_v1 scheduler", () => {
  test("schedules every new-card rating", () => {
    const card = baseCard("new");

    assert.deepEqual(scheduledState(card, "again"), {
      state: "learning",
      dueAt: "2026-05-16T10:05:00.000Z",
      intervalDays: 0,
      easeFactor: 2.3,
      reps: 1,
      lapses: 0,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "hard"), {
      state: "learning",
      dueAt: "2026-05-16T10:10:00.000Z",
      intervalDays: 0,
      easeFactor: 2.35,
      reps: 1,
      lapses: 0,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "good"), {
      state: "review",
      dueAt: "2026-05-17T10:00:00.000Z",
      intervalDays: 1,
      easeFactor: 2.5,
      reps: 1,
      lapses: 0,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "easy"), {
      state: "review",
      dueAt: "2026-05-20T10:00:00.000Z",
      intervalDays: 4,
      easeFactor: 2.65,
      reps: 1,
      lapses: 0,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
  });

  test("schedules every learning-card rating with the simple new-card behavior", () => {
    const card = baseCard("learning", { reps: 2 });

    assert.deepEqual(scheduledState(card, "again"), {
      state: "learning",
      dueAt: "2026-05-16T10:05:00.000Z",
      intervalDays: 0,
      easeFactor: 2.3,
      reps: 3,
      lapses: 0,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "hard"), {
      state: "learning",
      dueAt: "2026-05-16T10:10:00.000Z",
      intervalDays: 0,
      easeFactor: 2.35,
      reps: 3,
      lapses: 0,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.equal(scheduledState(card, "good").state, "review");
    assert.equal(scheduledState(card, "good").intervalDays, 1);
    assert.equal(scheduledState(card, "easy").state, "review");
    assert.equal(scheduledState(card, "easy").intervalDays, 4);
  });

  test("schedules every relearning-card rating with the simple new-card behavior", () => {
    const card = baseCard("relearning", { reps: 4, lapses: 1 });

    assert.deepEqual(scheduledState(card, "again"), {
      state: "relearning",
      dueAt: "2026-05-16T10:05:00.000Z",
      intervalDays: 0,
      easeFactor: 2.3,
      reps: 5,
      lapses: 1,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "hard"), {
      state: "relearning",
      dueAt: "2026-05-16T10:10:00.000Z",
      intervalDays: 0,
      easeFactor: 2.35,
      reps: 5,
      lapses: 1,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.equal(scheduledState(card, "good").state, "review");
    assert.equal(scheduledState(card, "good").intervalDays, 1);
    assert.equal(scheduledState(card, "easy").state, "review");
    assert.equal(scheduledState(card, "easy").intervalDays, 4);
  });

  test("schedules every review-card rating", () => {
    const card = baseCard("review", {
      intervalDays: 10,
      reps: 7,
      lapses: 1,
      lastReviewedAt: "2026-05-01T10:00:00.000Z",
    });

    assert.deepEqual(scheduledState(card, "again"), {
      state: "relearning",
      dueAt: "2026-05-16T10:10:00.000Z",
      intervalDays: 0,
      easeFactor: 2.3,
      reps: 8,
      lapses: 2,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "hard"), {
      state: "review",
      dueAt: "2026-05-28T10:00:00.000Z",
      intervalDays: 12,
      easeFactor: 2.35,
      reps: 8,
      lapses: 1,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "good"), {
      state: "review",
      dueAt: "2026-06-10T10:00:00.000Z",
      intervalDays: 25,
      easeFactor: 2.5,
      reps: 8,
      lapses: 1,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
    assert.deepEqual(scheduledState(card, "easy"), {
      state: "review",
      dueAt: "2026-06-19T10:00:00.000Z",
      intervalDays: 34,
      easeFactor: 2.65,
      reps: 8,
      lapses: 1,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt,
    });
  });

  test("applies ease floor and one-day hard interval edge cases", () => {
    const card = baseCard("review", {
      intervalDays: 0,
      easeFactor: 1.35,
    });

    assert.equal(scheduledState(card, "again").easeFactor, 1.3);
    assert.equal(scheduledState(card, "hard").easeFactor, 1.3);
    assert.equal(scheduledState(card, "hard").intervalDays, 1);
  });

  test("stores previous and next state snapshots in the review payload", () => {
    const card = baseCard("review", { intervalDays: 1, reps: 1 });
    const output = scheduleSimpleSm2({ card, rating: "good", reviewedAt });

    assert.deepEqual(JSON.parse(output.review.previousStateJson), {
      state: "review",
      dueAt: "2026-05-16T09:00:00.000Z",
      intervalDays: 1,
      easeFactor: 2.5,
      reps: 1,
      lapses: 0,
      lastReviewedAt: null,
    });
    assert.deepEqual(JSON.parse(output.review.nextStateJson), {
      state: "review",
      dueAt: "2026-05-19T10:00:00.000Z",
      intervalDays: 3,
      easeFactor: 2.5,
      reps: 2,
      lapses: 0,
      lastReviewedAt: reviewedAt,
    });
  });
});
