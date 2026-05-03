import { describe, expect, test } from "bun:test";

import { getHomePageData } from "../../shared/home-data";
import { createHomePageViewModel } from "./home-view-model";

describe("createHomePageViewModel", () => {
  test("summarizes the home screen data for the client", () => {
    const model = createHomePageViewModel(getHomePageData());

    expect(model.reviewHeadline).toBe("12 cards due");
    expect(model.latestSourceMeta).toContain("22 new words");
    expect(model.recentAdditionCount).toBe(3);
    expect(model.explorationTitles).toContain("Confusables to watch");
  });
});

