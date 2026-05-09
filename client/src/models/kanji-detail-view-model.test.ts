import { describe, expect, test } from "bun:test";

import { createKanjiDetailViewModel } from "./kanji-detail-view-model";

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
});
