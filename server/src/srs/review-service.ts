import type { Db } from "../db/connection.js";
import {
  getSrsCardById,
  insertSrsReview,
  updateSrsCardState,
  type SrsReviewInsertInput,
} from "../db/srs-repositories.js";
import { buildSrsReviewId } from "./ids.js";
import { getSrsScheduler } from "./scheduler-registry.js";
import type { SrsCard, SrsReviewRating, SrsReviewRow } from "./types.js";

export type ReviewSrsCardInput = {
  cardId: string;
  rating: SrsReviewRating;
  reviewedAt: string;
};

export type ReviewSrsCardResult = {
  card: SrsCard;
  review: SrsReviewRow;
};

export class SrsReviewError extends Error {
  constructor(
    message: string,
    public readonly code: "card_not_found" | "card_disabled" | "unknown_scheduler" | "card_update_failed",
  ) {
    super(message);
    this.name = "SrsReviewError";
  }
}

export function reviewSrsCard(db: Db, input: ReviewSrsCardInput): ReviewSrsCardResult {
  const reviewTransaction = db.transaction(() => {
    const card = getSrsCardById(db, input.cardId);

    if (!card) {
      throw new SrsReviewError(`SRS card not found: ${input.cardId}`, "card_not_found");
    }

    if (!card.enabled) {
      throw new SrsReviewError(`SRS card is disabled: ${input.cardId}`, "card_disabled");
    }

    const scheduler = getSrsScheduler(card.schedulerVersion);

    if (!scheduler) {
      throw new SrsReviewError(`Unknown SRS scheduler: ${card.schedulerVersion}`, "unknown_scheduler");
    }

    const scheduled = scheduler({
      card,
      rating: input.rating,
      reviewedAt: input.reviewedAt,
    });
    const reviewInput: SrsReviewInsertInput = {
      id: buildSrsReviewId(),
      cardId: card.id,
      ...scheduled.review,
    };
    const review = insertSrsReview(db, reviewInput);
    const updatedCard = updateSrsCardState(db, card.id, scheduled.nextCardState);

    if (!updatedCard) {
      throw new SrsReviewError(`Failed to update SRS card: ${card.id}`, "card_update_failed");
    }

    return {
      card: updatedCard,
      review,
    };
  });

  return reviewTransaction();
}
