export const srsCardKinds = ["kanji_recognition", "kanji_production"] as const;
export const srsCardStates = ["new", "learning", "review", "relearning"] as const;
export const srsReviewRatings = ["again", "hard", "good", "easy"] as const;

export type SrsCardKind = (typeof srsCardKinds)[number];
export type SrsCardState = (typeof srsCardStates)[number];
export type SrsReviewRating = (typeof srsReviewRatings)[number];

export type SrsCard = {
  id: string;
  kanjiLiteral: string;
  cardKind: SrsCardKind;
  enabled: boolean;
  schedulerVersion: string;
  state: SrsCardState;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SrsCardSnapshot = {
  state: SrsCardState;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string | null;
};

export type SrsNextCardState = {
  state: SrsCardState;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string;
  updatedAt: string;
};

export type SrsReviewInsert = {
  reviewedAt: string;
  rating: SrsReviewRating;
  previousStateJson: string;
  nextStateJson: string;
};

export type SrsSchedulerConfig = {
  defaultEaseFactor: number;
  easeFloor: number;
  againMinutes: number;
  hardMinutes: number;
  goodInitialDays: number;
  easyInitialDays: number;
  hardIntervalMultiplier: number;
  easyIntervalMultiplier: number;
  againEaseDelta: number;
  hardEaseDelta: number;
  easyEaseDelta: number;
};

export type SrsSchedulerInput = {
  card: SrsCard;
  rating: SrsReviewRating;
  reviewedAt: string;
  config?: Partial<SrsSchedulerConfig>;
};

export type SrsSchedulerOutput = {
  nextCardState: SrsNextCardState;
  review: SrsReviewInsert;
  debug?: Record<string, unknown>;
};

export type SrsScheduler = (input: SrsSchedulerInput) => SrsSchedulerOutput;

export type SrsReviewRow = {
  id: string;
  cardId: string;
  reviewedAt: string;
  rating: SrsReviewRating;
  previousStateJson: string;
  nextStateJson: string;
};
