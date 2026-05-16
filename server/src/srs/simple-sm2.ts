import type {
  SrsCard,
  SrsCardSnapshot,
  SrsNextCardState,
  SrsReviewRating,
  SrsSchedulerConfig,
  SrsSchedulerInput,
  SrsSchedulerOutput,
} from "./types.js";

export const simpleSm2SchedulerVersion = "simple_sm2_v1";

export const defaultSimpleSm2Config: SrsSchedulerConfig = {
  defaultEaseFactor: 2.5,
  easeFloor: 1.3,
  againMinutes: 5,
  hardMinutes: 10,
  goodInitialDays: 1,
  easyInitialDays: 4,
  hardIntervalMultiplier: 1.2,
  easyIntervalMultiplier: 1.3,
  againEaseDelta: -0.2,
  hardEaseDelta: -0.15,
  easyEaseDelta: 0.15,
};

function addMinutes(timestamp: string, minutes: number) {
  return new Date(new Date(timestamp).getTime() + minutes * 60 * 1000).toISOString();
}

function addDays(timestamp: string, days: number) {
  return new Date(new Date(timestamp).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function easeDelta(rating: SrsReviewRating, config: SrsSchedulerConfig) {
  switch (rating) {
    case "again":
      return config.againEaseDelta;
    case "hard":
      return config.hardEaseDelta;
    case "easy":
      return config.easyEaseDelta;
    case "good":
      return 0;
  }
}

function nextEaseFactor(card: SrsCard, rating: SrsReviewRating, config: SrsSchedulerConfig) {
  return Math.max(config.easeFloor, Number((card.easeFactor + easeDelta(rating, config)).toFixed(2)));
}

function snapshot(card: SrsCard | SrsNextCardState): SrsCardSnapshot {
  return {
    state: card.state,
    dueAt: card.dueAt,
    intervalDays: card.intervalDays,
    easeFactor: card.easeFactor,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewedAt: card.lastReviewedAt,
  };
}

function scheduleLearningLike(
  card: SrsCard,
  rating: SrsReviewRating,
  reviewedAt: string,
  config: SrsSchedulerConfig,
): Pick<SrsNextCardState, "state" | "dueAt" | "intervalDays"> {
  switch (rating) {
    case "again":
      return {
        state: card.state === "relearning" ? "relearning" : "learning",
        dueAt: addMinutes(reviewedAt, config.againMinutes),
        intervalDays: 0,
      };
    case "hard":
      return {
        state: card.state === "relearning" ? "relearning" : "learning",
        dueAt: addMinutes(reviewedAt, config.hardMinutes),
        intervalDays: 0,
      };
    case "good":
      return {
        state: "review",
        dueAt: addDays(reviewedAt, config.goodInitialDays),
        intervalDays: config.goodInitialDays,
      };
    case "easy":
      return {
        state: "review",
        dueAt: addDays(reviewedAt, config.easyInitialDays),
        intervalDays: config.easyInitialDays,
      };
  }
}

function scheduleReview(
  card: SrsCard,
  rating: SrsReviewRating,
  reviewedAt: string,
  easeFactor: number,
  config: SrsSchedulerConfig,
): Pick<SrsNextCardState, "state" | "dueAt" | "intervalDays" | "lapses"> {
  switch (rating) {
    case "again":
      return {
        state: "relearning",
        dueAt: addMinutes(reviewedAt, config.hardMinutes),
        intervalDays: 0,
        lapses: card.lapses + 1,
      };
    case "hard": {
      const intervalDays = Math.max(1, Math.round(card.intervalDays * config.hardIntervalMultiplier));

      return {
        state: "review",
        dueAt: addDays(reviewedAt, intervalDays),
        intervalDays,
        lapses: card.lapses,
      };
    }
    case "good": {
      const intervalDays = Math.round(card.intervalDays * easeFactor);

      return {
        state: "review",
        dueAt: addDays(reviewedAt, intervalDays),
        intervalDays,
        lapses: card.lapses,
      };
    }
    case "easy": {
      const intervalDays = Math.round(card.intervalDays * easeFactor * config.easyIntervalMultiplier);

      return {
        state: "review",
        dueAt: addDays(reviewedAt, intervalDays),
        intervalDays,
        lapses: card.lapses,
      };
    }
  }
}

export function scheduleSimpleSm2(input: SrsSchedulerInput): SrsSchedulerOutput {
  const config = { ...defaultSimpleSm2Config, ...input.config };
  const easeFactor = nextEaseFactor(input.card, input.rating, config);
  const base = {
    easeFactor,
    reps: input.card.reps + 1,
    lastReviewedAt: input.reviewedAt,
    updatedAt: input.reviewedAt,
  };
  const scheduled =
    input.card.state === "review"
      ? scheduleReview(input.card, input.rating, input.reviewedAt, easeFactor, config)
      : {
          ...scheduleLearningLike(input.card, input.rating, input.reviewedAt, config),
          lapses: input.card.lapses,
        };
  const nextCardState: SrsNextCardState = {
    ...scheduled,
    ...base,
  };

  return {
    nextCardState,
    review: {
      reviewedAt: input.reviewedAt,
      rating: input.rating,
      previousStateJson: JSON.stringify(snapshot(input.card)),
      nextStateJson: JSON.stringify(snapshot(nextCardState)),
    },
    debug: {
      schedulerVersion: simpleSm2SchedulerVersion,
      rating: input.rating,
      previousIntervalDays: input.card.intervalDays,
    },
  };
}
