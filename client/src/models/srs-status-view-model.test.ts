import { describe, expect, test } from "bun:test";

import type { SrsCardSummary, SrsKanjiMatrixResponse } from "../../../shared/srs";
import {
  createSrsStatusRows,
  labelDue,
  toggleSrsStatusSort,
  type SrsStatusSort,
} from "./srs-status-view-model";

const generatedAt = "2026-05-20T10:00:00.000Z";

function card(input: Partial<SrsCardSummary> & Pick<SrsCardSummary, "cardKind" | "dueAt">): SrsCardSummary {
  return {
    id: `${input.cardKind}-${input.dueAt}`,
    kanjiLiteral: "具",
    enabled: true,
    schedulerVersion: "simple_sm2_v1",
    state: "review",
    intervalDays: 1,
    easeFactor: 2.5,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    ...input,
  };
}

function response(): SrsKanjiMatrixResponse {
  return {
    generatedAt,
    items: [
      {
        kanjiLiteral: "具",
        meaning: "tool",
        nextDueAt: "2026-05-20T12:00:00.000Z",
        nextDueStatus: "today",
        recognition: card({
          cardKind: "kanji_recognition",
          dueAt: "2026-05-20T12:00:00.000Z",
          state: "learning",
          reps: 4,
        }),
        production: card({
          cardKind: "kanji_production",
          dueAt: "2026-05-24T10:00:00.000Z",
          state: "review",
          reps: 6,
        }),
        totalReps: 10,
        totalLapses: 1,
      },
      {
        kanjiLiteral: "日",
        meaning: "sun, day",
        nextDueAt: "2026-05-19T10:00:00.000Z",
        nextDueStatus: "overdue",
        recognition: card({
          cardKind: "kanji_recognition",
          dueAt: "2026-05-21T10:00:00.000Z",
          reps: 3,
        }),
        production: card({
          cardKind: "kanji_production",
          dueAt: "2026-05-18T10:00:00.000Z",
          state: "relearning",
          reps: 2,
        }),
        totalReps: 5,
        totalLapses: 2,
      },
      {
        kanjiLiteral: "忘",
        meaning: "forget",
        nextDueAt: null,
        nextDueStatus: "disabled",
        recognition: card({
          cardKind: "kanji_recognition",
          dueAt: "2026-05-18T10:00:00.000Z",
          enabled: false,
          reps: 40,
        }),
        production: null,
        totalReps: 99,
        totalLapses: 0,
      },
    ],
  };
}

describe("SRS status view model", () => {
  test("toggles sort keys and directions", () => {
    const nextSort = toggleSrsStatusSort({ key: "next", direction: "asc" }, "next");
    const loadSort = toggleSrsStatusSort(nextSort, "load");

    expect(nextSort).toEqual({ key: "next", direction: "desc" });
    expect(loadSort).toEqual({ key: "load", direction: "asc" });
  });

  test("sorts by next due with disabled rows last", () => {
    expect(createSrsStatusRows(response()).map((row) => row.kanjiLiteral)).toEqual(["日", "具", "忘"]);
  });

  test("sorts by recognition and production due dates", () => {
    const recognitionSort: SrsStatusSort = { key: "recognition", direction: "asc" };
    const productionSort: SrsStatusSort = { key: "production", direction: "desc" };

    expect(createSrsStatusRows(response(), recognitionSort).map((row) => row.kanjiLiteral)).toEqual([
      "具",
      "日",
      "忘",
    ]);
    expect(createSrsStatusRows(response(), productionSort).map((row) => row.kanjiLiteral)).toEqual([
      "具",
      "日",
      "忘",
    ]);
  });

  test("sorts load by total reps", () => {
    expect(createSrsStatusRows(response(), { key: "load", direction: "desc" }).map((row) => row.kanjiLiteral)).toEqual([
      "忘",
      "具",
      "日",
    ]);
  });

  test("formats due and card labels", () => {
    const rows = createSrsStatusRows(response());
    const tool = rows.find((row) => row.kanjiLiteral === "具");
    const forget = rows.find((row) => row.kanjiLiteral === "忘");
    const now = new Date(generatedAt);

    expect(labelDue(new Date("2026-05-19T10:00:00.000Z"), now)).toBe("overdue");
    expect(labelDue(new Date("2026-05-20T09:00:00.000Z"), now)).toBe("due now");
    expect(labelDue(new Date("2026-05-20T12:00:00.000Z"), now)).toBe("today");
    expect(labelDue(new Date("2026-05-24T10:00:00.000Z"), now)).toBe("in 4d");
    expect(tool?.recognition.label).toBe("learning · today");
    expect(forget?.recognition.label).toBe("disabled");
    expect(forget?.production.meta).toBe("missing card");
  });
});
