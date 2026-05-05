import { describe, expect, test } from "bun:test";

import { closePane, closeRightmostPane, createInitialPaneKeys, openPane } from "./pane-state";

describe("pane state", () => {
  test("starts with the home pane", () => {
    expect(createInitialPaneKeys()).toEqual(["home"]);
  });

  test("opens a pane to the right", () => {
    expect(openPane(["home"], "kanji:具")).toEqual(["home", "kanji:具"]);
  });

  test("trims panes to the right of the source pane", () => {
    expect(openPane(["home", "kanji:具", "kanji:美"], "review", 0)).toEqual(["home", "review"]);
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
});
