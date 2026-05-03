import { describe, expect, test } from "bun:test";

import { createApp } from "./app.js";

describe("server app", () => {
  test("reports health", async () => {
    const app = createApp();
    const response = await app(new Request("http://localhost/api/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test("returns home page data", async () => {
    const app = createApp();
    const response = await app(new Request("http://localhost/api/home"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.review.dueCount).toBe(12);
    expect(body.latestSource.title).toBe("Lesson 12");
  });
});
