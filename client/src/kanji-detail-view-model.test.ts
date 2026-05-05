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
      readings: [],
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
    expect(model.strokeOrderImage?.url).toBe("/api/media/media");
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
  });
});
