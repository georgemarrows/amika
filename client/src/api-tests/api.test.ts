import { afterEach, describe, expect, test } from "bun:test";

import { fetchSearchResults } from "../api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("api", () => {
  test("fetches search results with an encoded query", async () => {
    let requestedUrl = "";

    globalThis.fetch = ((input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            query: "勉 強",
            items: [],
          }),
          { status: 200 },
        ),
      );
    }) as unknown as typeof fetch;

    await expect(fetchSearchResults("勉 強")).resolves.toEqual({
      query: "勉 強",
      items: [],
    });
    expect(requestedUrl).toBe("/api/search?q=%E5%8B%89%20%E5%BC%B7");
  });

  test("throws when search results fail to load", async () => {
    globalThis.fetch = (() => Promise.resolve(new Response("Nope", { status: 503 }))) as unknown as typeof fetch;

    await expect(fetchSearchResults("勉")).rejects.toThrow("Failed to load search results: 503");
  });
});
