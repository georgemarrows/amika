import { afterEach, describe, expect, test } from "bun:test";

import {
  fetchSearchResults,
  fetchSrsKanjiMatrix,
  fetchSrsReviewQueue,
  setKanjiSrsEnabled,
  submitSrsReview,
} from "../api";

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

  test("fetches the SRS review queue", async () => {
    let requestedUrl = "";

    globalThis.fetch = ((input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            dueCount: 0,
            card: null,
            generatedAt: "2026-05-16T10:00:00.000Z",
          }),
          { status: 200 },
        ),
      );
    }) as unknown as typeof fetch;

    await expect(fetchSrsReviewQueue()).resolves.toEqual({
      dueCount: 0,
      card: null,
      generatedAt: "2026-05-16T10:00:00.000Z",
    });
    expect(requestedUrl).toBe("/api/srs/review");
  });

  test("fetches the SRS kanji matrix", async () => {
    let requestedUrl = "";

    globalThis.fetch = ((input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            generatedAt: "2026-05-16T10:00:00.000Z",
            items: [],
          }),
          { status: 200 },
        ),
      );
    }) as unknown as typeof fetch;

    await expect(fetchSrsKanjiMatrix()).resolves.toEqual({
      generatedAt: "2026-05-16T10:00:00.000Z",
      items: [],
    });
    expect(requestedUrl).toBe("/api/srs/cards/matrix");
  });

  test("throws when SRS kanji matrix fails to load", async () => {
    globalThis.fetch = (() => Promise.resolve(new Response("Nope", { status: 503 }))) as unknown as typeof fetch;

    await expect(fetchSrsKanjiMatrix()).rejects.toThrow("Failed to load SRS card status: 503");
  });

  test("submits SRS reviews as JSON", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            dueCount: 0,
            reviewedCardId: "card",
            nextCard: null,
          }),
          { status: 200 },
        ),
      );
    }) as unknown as typeof fetch;

    await expect(submitSrsReview("card", "good")).resolves.toEqual({
      dueCount: 0,
      reviewedCardId: "card",
      nextCard: null,
    });
    expect(requestedUrl).toBe("/api/srs/reviews");
    expect(requestedInit?.method).toBe("POST");
    expect(requestedInit?.body).toBe(JSON.stringify({ cardId: "card", rating: "good" }));
  });

  test("updates kanji SRS status as JSON", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            enabled: true,
            dueCount: 2,
            cards: [],
          }),
          { status: 200 },
        ),
      );
    }) as unknown as typeof fetch;

    await expect(setKanjiSrsEnabled("具", true)).resolves.toEqual({
      enabled: true,
      dueCount: 2,
      cards: [],
    });
    expect(requestedUrl).toBe("/api/kanji/%E5%85%B7/srs");
    expect(requestedInit?.method).toBe("POST");
    expect(requestedInit?.body).toBe(JSON.stringify({ enabled: true }));
  });
});
