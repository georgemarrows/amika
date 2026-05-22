import { describe, expect, test } from "bun:test";

import { createKanjiDetailViewModel } from "./kanji-detail-view-model";

const noSrs = {
  enabled: false,
  dueCount: 0,
  cards: [],
};

describe("createKanjiDetailViewModel", () => {
  test("formats imported kanji metadata", () => {
    const model = createKanjiDetailViewModel({
      literal: "具",
      meaning: "tool",
      strokeCount: 8,
      usefulness: "★★★★☆",
      frequencyRank: 683,
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
      srs: noSrs,
      mnemonics: [],
      words: [],
      relations: [],
    });

    expect(model.literal).toBe("具");
    expect(model.meaning).toBe("tool");
    expect(model.metadata).toEqual([
      { label: "Strokes", value: "8" },
      { label: "Usefulness", value: "★★★★☆" },
      { label: "Frequency", value: "#683" },
    ]);
    expect(model.readingGroups).toEqual([
      {
        label: "On",
        readings: [
          {
            type: "on",
            reading: "GU",
            meaning: null,
            usefulness: null,
          },
        ],
      },
    ]);
    expect(model.strokeOrderImage?.url).toBe("/api/media/media");
  });

  test("exposes imported words for rendering", () => {
    const model = createKanjiDetailViewModel({
      literal: "具",
      meaning: "tool",
      strokeCount: 8,
      usefulness: "★★★★☆",
      frequencyRank: 683,
      strokeOrderImage: null,
      components: [],
      readings: [],
      srs: noSrs,
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

    expect(model.words).toEqual([
      {
        id: "word-dogu",
        expression: "道具",
        reading: "どうぐ",
        meaning: "tool",
        usefulness: "★★★★☆",
      },
    ]);
  });

  test("groups readings by type for rendering", () => {
    const model = createKanjiDetailViewModel({
      literal: "日",
      meaning: "sun, day",
      strokeCount: 4,
      usefulness: "★★★★★",
      frequencyRank: 1,
      strokeOrderImage: null,
      components: [],
      readings: [
        { type: "on", reading: "NICHI", meaning: null, usefulness: null },
        { type: "on", reading: "JITSU", meaning: null, usefulness: null },
        { type: "kun", reading: "ひ", meaning: "a day", usefulness: "★★★★★" },
      ],
      srs: noSrs,
      mnemonics: [],
      words: [],
      relations: [],
    });

    expect(model.readingGroups).toEqual([
      {
        label: "On",
        readings: [
          { type: "on", reading: "NICHI", meaning: null, usefulness: null },
          { type: "on", reading: "JITSU", meaning: null, usefulness: null },
        ],
      },
      {
        label: "Kun",
        readings: [
          { type: "kun", reading: "ひ", meaning: "a day", usefulness: "★★★★★" },
        ],
      },
    ]);
  });

  test("uses clear placeholders for missing optional data", () => {
    const model = createKanjiDetailViewModel({
      literal: "美",
      meaning: "beauty",
      strokeCount: null,
      usefulness: null,
      frequencyRank: null,
      strokeOrderImage: null,
      components: [],
      readings: [],
      srs: noSrs,
      mnemonics: [],
      words: [],
      relations: [],
    });

    expect(model.metadata).toEqual([
      { label: "Strokes", value: "Unknown" },
      { label: "Usefulness", value: "Unknown" },
      { label: "Frequency", value: "Unknown" },
    ]);
    expect(model.strokeOrderImage).toBeNull();
    expect(model.readingGroups).toEqual([]);
  });

  test("formats SRS status and per-card labels", () => {
    const model = createKanjiDetailViewModel({
      literal: "具",
      meaning: "tool",
      strokeCount: 8,
      usefulness: "★★★★☆",
      frequencyRank: 683,
      strokeOrderImage: null,
      components: [],
      readings: [],
      srs: {
        enabled: true,
        dueCount: 2,
        cards: [
          {
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
          },
          {
            id: "recognition",
            kanjiLiteral: "具",
            cardKind: "kanji_recognition",
            enabled: true,
            schedulerVersion: "simple_sm2_v1",
            state: "learning",
            dueAt: "2026-05-16T10:00:00.000Z",
            intervalDays: 0,
            easeFactor: 2.5,
            reps: 1,
            lapses: 0,
            lastReviewedAt: null,
          },
        ],
      },
      mnemonics: [],
      words: [],
      relations: [],
    });

    expect(model.srs.enabled).toBe(true);
    expect(model.srs.statusLabel).toBe("In SRS");
    expect(model.srs.actionLabel).toBe("Remove from SRS");
    expect(model.srs.cards.map((card) => [card.label, card.stateLabel])).toEqual([
      ["Production", ""],
      ["Recognition", "learning"],
    ]);
  });
});
