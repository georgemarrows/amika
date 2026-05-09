import { describe, expect, test } from "bun:test";

import { closePane, closeRightmostPane, createInitialPaneKeys, createPaneState, openPane } from "./pane-state";

describe("pane state", () => {
  test("starts with the home pane", () => {
    expect(createInitialPaneKeys()).toEqual(["home"]);
  });

  test("opens a pane to the right", () => {
    expect(openPane(["home"], "kanji:具")).toEqual(["home", "kanji:具"]);
    expect(openPane(["home", "kanji:具"], "word:word-dogu", 1)).toEqual(["home", "kanji:具", "word:word-dogu"]);
  });

  test("trims panes to the right of the source pane", () => {
    expect(openPane(["home", "kanji:具", "kanji:美"], "review", 0)).toEqual(["home", "review"]);
    expect(openPane(["home", "kanji:具", "word:word-dogu"], "word:word-kagu", 1)).toEqual([
      "home",
      "kanji:具",
      "word:word-kagu",
    ]);
  });

  test("does not duplicate an already-visible pane", () => {
    expect(openPane(["home", "kanji:具"], "kanji:具")).toEqual(["home", "kanji:具"]);
  });

  test("closes a selected pane but keeps at least one pane", () => {
    expect(closePane(["home", "kanji:具"], "kanji:具")).toEqual(["home"]);
    expect(closePane(["home"], "home")).toEqual(["home"]);
  });

  test("closes the rightmost pane", () => {
    expect(closeRightmostPane(["home", "kanji:具", "review"])).toEqual(["home", "kanji:具"]);
    expect(closeRightmostPane(["home"])).toEqual(["home"]);
  });

  test("provides a specialized Solid state helper without a singleton", () => {
    const state = createPaneState();

    state.openFromRoot("kanji:具");
    expect(state.panes()).toEqual(["home", "kanji:具"]);

    state.openFromPane("review", 0);
    expect(state.panes()).toEqual(["home", "review"]);

    state.closeRightmost();
    expect(state.panes()).toEqual(["home"]);
  });
});
