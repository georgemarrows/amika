import { describe, expect, test } from "bun:test";

import { createWordDetailViewModel } from "./word-detail-view-model";

describe("createWordDetailViewModel", () => {
  test("formats imported word detail", () => {
    const model = createWordDetailViewModel({
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

    expect(model.expression).toBe("道具");
    expect(model.reading).toBe("どうぐ");
    expect(model.primaryMeaning).toBe("tool");
    expect(model.usefulness).toBe("★★★★☆");
    expect(model.meanings).toEqual(["tool"]);
    expect(model.kanji).toEqual([
      { literal: "道", meaning: "street" },
      { literal: "具", meaning: "tool" },
    ]);
  });

  test("uses clear placeholders for missing optional data", () => {
    const model = createWordDetailViewModel({
      id: "word-empty",
      expression: "言葉",
      reading: null,
      primaryMeaning: null,
      usefulness: null,
      meanings: [],
      kanji: [],
    });

    expect(model.reading).toBe("Unknown");
    expect(model.primaryMeaning).toBe("Unknown");
    expect(model.usefulness).toBe("Unknown");
    expect(model.meanings).toEqual([]);
  });
});
