import type { KanjiReading } from "./kanji-reading.js";
import type { KanjiWordSummary } from "./kanji-detail.js";

export type SrsCardKind = "kanji_recognition" | "kanji_production";
export type SrsCardState = "new" | "learning" | "review" | "relearning";
export type SrsReviewRating = "again" | "hard" | "good" | "easy";

export type SrsApiErrorCode =
  | "invalid_request"
  | "kanji_not_found"
  | "srs_card_not_found"
  | "srs_card_disabled"
  | "unknown_scheduler"
  | "database_unavailable";

export type SrsApiErrorResponse = {
  error: SrsApiErrorCode;
  message: string;
};

export type SrsCardSummary = {
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
};

export type KanjiSrsStatusResponse = {
  enabled: boolean;
  dueCount: number;
  cards: SrsCardSummary[];
};

export type SrsReviewCardResponse = SrsCardSummary & {
  meaning: string;
  readings: KanjiReading[];
  words: KanjiWordSummary[];
};

export type SrsReviewQueueResponse = {
  dueCount: number;
  card: SrsReviewCardResponse | null;
  generatedAt: string;
};

export type SrsReviewSubmitRequest = {
  cardId: string;
  rating: SrsReviewRating;
};

export type SrsReviewSubmitResponse = {
  dueCount: number;
  reviewedCardId: string;
  nextCard: SrsReviewCardResponse | null;
};

export type KanjiSrsToggleRequest = {
  enabled: boolean;
};
