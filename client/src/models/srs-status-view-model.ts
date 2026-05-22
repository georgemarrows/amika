import type {
  SrsCardSummary,
  SrsKanjiMatrixItem,
  SrsKanjiMatrixResponse,
} from "../../../shared/srs";
import { labelSrsCardState } from "./srs-card-labels";

export type SrsStatusSortKey = "next" | "recognition" | "production" | "load";
export type SrsStatusSortDirection = "asc" | "desc";

export type SrsStatusSort = {
  key: SrsStatusSortKey;
  direction: SrsStatusSortDirection;
};

export type SrsStatusCardCellViewModel = {
  label: string;
  tone: "new" | "learning" | "review" | "relearning" | "disabled";
  sortValue: number | null;
  stats: SrsStatusStats;
};

export type SrsStatusStats = {
  reps: number;
  lapses: number;
}

export type SrsStatusRowViewModel = {
  kanjiLiteral: string;
  meaning: string;
  targetPaneKey: `kanji:${string}`;
  nextLabel: string;
  nextTone: SrsStatusCardCellViewModel["tone"];
  nextSortValue: number | null;
  recognition: SrsStatusCardCellViewModel;
  production: SrsStatusCardCellViewModel;
  stats: SrsStatusStats;
  totalReps: number;
};

const dayMs = 24 * 60 * 60 * 1000;

export const initialSrsStatusSort: SrsStatusSort = {
  key: "next",
  direction: "asc",
};

export function toggleSrsStatusSort(current: SrsStatusSort, key: SrsStatusSortKey): SrsStatusSort {
  if (current.key !== key) {
    return { key, direction: "asc" };
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

export function createSrsStatusRows(
  response: SrsKanjiMatrixResponse,
  sort: SrsStatusSort = initialSrsStatusSort,
): SrsStatusRowViewModel[] {
  const now = new Date(response.generatedAt);

  return response.items
    .map((item) => createSrsStatusRow(item, now))
    .sort((left, right) => compareSrsStatusRows(left, right, sort));
}

export function createSrsStatusRow(
  item: SrsKanjiMatrixItem,
  now: Date,
): SrsStatusRowViewModel {
  const nextDue = item.nextDueAt ? new Date(item.nextDueAt) : null;
  const recognition = createCardCell(item.recognition, now);
  const production = createCardCell(item.production, now);

  return {
    kanjiLiteral: item.kanjiLiteral,
    meaning: item.meaning,
    targetPaneKey: `kanji:${item.kanjiLiteral}`,
    nextLabel: labelDue(nextDue, now),
    nextTone: nextDue ? toneForDue(nextDue, now) : "disabled",
    nextSortValue: nextDue ? nextDue.getTime() : null,
    recognition,
    production,
    stats: { reps: item.totalReps, lapses: item.totalLapses },
    totalReps: item.totalReps,
  };
}

function createCardCell(card: SrsCardSummary | null, now: Date): SrsStatusCardCellViewModel {
  if (!card || !card.enabled) {
    return {
      label: "disabled",
      tone: "disabled",
      sortValue: null,
      stats: { reps: card ? card.reps : 0, lapses: card ? card.lapses : 0 },
    };
  }

  const due = new Date(card.dueAt);
  const dueLabel = labelDue(due, now);

  return {
    label: `${labelSrsCardState(card.state)} ${dueLabel}`,
    tone: toneForCard(card, due, now),
    sortValue: due.getTime(),
    stats: { reps: card.reps, lapses: card.lapses },
  };
}

function compareSrsStatusRows(
  left: SrsStatusRowViewModel,
  right: SrsStatusRowViewModel,
  sort: SrsStatusSort,
) {
  const compared = compareSortValues(sortValue(left, sort.key), sortValue(right, sort.key), sort.direction);

  if (compared !== 0) {
    return compared;
  }

  return left.kanjiLiteral.localeCompare(right.kanjiLiteral);
}

function sortValue(row: SrsStatusRowViewModel, key: SrsStatusSortKey) {
  switch (key) {
    case "next":
      return row.nextSortValue;
    case "recognition":
      return row.recognition.sortValue;
    case "production":
      return row.production.sortValue;
    case "load":
      return row.totalReps;
  }
}

function compareSortValues(
  left: number | null,
  right: number | null,
  direction: SrsStatusSortDirection,
) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return direction === "asc" ? left - right : right - left;
}

export function labelDue(dueAt: Date | null, now: Date) {
  if (!dueAt) {
    return "disabled";
  }

  if (dueAt <= now) {
    return sameLocalDay(dueAt, now) ? "due now" : "overdue";
  }

  if (sameLocalDay(dueAt, now)) {
    return "today";
  }

  const dueDay = startOfLocalDay(dueAt).getTime();
  const today = startOfLocalDay(now).getTime();
  const days = Math.max(1, Math.round((dueDay - today) / dayMs));

  return `in ${days}d`;
}

function toneForCard(card: SrsCardSummary, dueAt: Date, now: Date): SrsStatusCardCellViewModel["tone"] {
  if (dueAt <= now && card.state === "relearning") {
    return "relearning";
  }

  if (card.state === "learning") {
    return "learning";
  }

  if (card.state === "new") {
    return "new";
  }

  return dueAt <= now ? "learning" : "review";
}

function toneForDue(dueAt: Date, now: Date): SrsStatusCardCellViewModel["tone"] {
  if (dueAt <= now && !sameLocalDay(dueAt, now)) {
    return "relearning";
  }

  if (dueAt <= now || sameLocalDay(dueAt, now)) {
    return "learning";
  }

  return "review";
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
