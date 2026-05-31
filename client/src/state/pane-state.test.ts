import { describe, expect, test } from "bun:test";

import {
  closePane,
  closeRightmostPane,
  createInitialPaneKeys,
  createPaneState,
  describePane,
  openPane,
  openRootPane,
  willScrollToExistingPane,
} from "./pane-state";

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

  test("detects when opening should scroll back to an existing pane", () => {
    expect(willScrollToExistingPane(["home", "kanji:具"], "kanji:具")).toBe(true);
    expect(willScrollToExistingPane(["home", "kanji:具", "word:word-dogu"], "word:word-dogu", 0)).toBe(false);
    expect(willScrollToExistingPane(["home", "kanji:具", "word:word-dogu"], "kanji:具", 2)).toBe(true);
  });

  test("opens root navigation as the whole pane stack", () => {
    expect(openRootPane("list-kanji")).toEqual(["list-kanji"]);
    expect(openRootPane("srs-status")).toEqual(["srs-status"]);
    expect(openRootPane("home")).toEqual(["home"]);
  });

  test("describes the SRS status pane", () => {
    expect(describePane("srs-status")).toEqual({
      key: "srs-status",
      className: "srs-status-pane",
    });
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

    state.openFromRoot("list-kanji");
    expect(state.panes()).toEqual(["list-kanji"]);
    expect(state.scrollTarget().key).toBe("list-kanji");

    state.openFromPane("review", 0);
    expect(state.panes()).toEqual(["list-kanji", "review"]);
    expect(state.scrollTarget().key).toBe("review");

    state.closeRightmost();
    expect(state.panes()).toEqual(["list-kanji"]);
  });

  test("requests scrolling even when opening an already-visible pane", () => {
    const state = createPaneState(["home", "kanji:具", "word:word-dogu"]);
    const firstRequestId = state.scrollTarget().requestId;

    state.openFromPane("kanji:具", 2);

    expect(state.panes()).toEqual(["home", "kanji:具", "word:word-dogu"]);
    expect(state.scrollTarget()).toEqual({
      key: "kanji:具",
      requestId: firstRequestId + 1,
      flash: true,
    });
  });
});
