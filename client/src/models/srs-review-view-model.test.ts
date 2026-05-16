import { describe, expect, test } from "bun:test";

import { createSrsReviewCardViewModel } from "./srs-review-view-model";

describe("createSrsReviewCardViewModel", () => {
  test("formats recognition cards", () => {
    const model = createSrsReviewCardViewModel({
      id: "recognition",
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
      meaning: "tool",
      readings: [
        { type: "on", reading: "GU", meaning: null, usefulness: null },
        { type: "kun", reading: "そな.える", meaning: "to equip", usefulness: null },
      ],
      words: [],
    });

    expect(model.kindLabel).toBe("Recognition");
    expect(model.isRecognition).toBe(true);
    expect(model.promptNote).toBe("Name the readings and English meaning.");
    expect(model.onReadings.map((reading) => reading.reading)).toEqual(["GU"]);
    expect(model.kunReadings.map((reading) => reading.reading)).toEqual(["そな.える"]);
  });

  test("formats production cards", () => {
    const model = createSrsReviewCardViewModel({
      id: "production",
      kanjiLiteral: "具",
      cardKind: "kanji_production",
      enabled: true,
      schedulerVersion: "simple_sm2_v1",
      state: "review",
      dueAt: "2026-05-16T10:00:00.000Z",
      intervalDays: 3,
      easeFactor: 2.5,
      reps: 4,
      lapses: 0,
      lastReviewedAt: null,
      meaning: "tool",
      readings: [],
      words: [
        {
          id: "word-dogu",
          expression: "道具",
          reading: "どうぐ",
          meaning: "tool",
          usefulness: "★★★★☆",
        },
      ],
    });

    expect(model.kindLabel).toBe("Production");
    expect(model.isRecognition).toBe(false);
    expect(model.promptNote).toBe("Produce the kanji from the meaning and readings.");
    expect(model.stateLabel).toBe("review · due now");
    expect(model.words.map((word) => word.expression)).toEqual(["道具"]);
  });
});
