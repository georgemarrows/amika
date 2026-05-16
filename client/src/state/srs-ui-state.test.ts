import { afterEach, describe, expect, test } from "bun:test";

import { createSrsUiState } from "./srs-ui-state";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createSrsUiState", () => {
  test("stores and clamps due count", () => {
    const state = createSrsUiState(3);

    expect(state.dueCount()).toBe(3);
    state.setDueCount(-4);
    expect(state.dueCount()).toBe(0);
    state.setDueCount(8);
    expect(state.dueCount()).toBe(8);
  });

  test("refreshes due count from the SRS queue endpoint", async () => {
    const state = createSrsUiState(3);

    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            dueCount: 5,
            card: null,
            generatedAt: "2026-05-16T10:00:00.000Z",
          }),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    await state.refreshDueCountFromQueue();

    expect(state.dueCount()).toBe(5);
  });
});
