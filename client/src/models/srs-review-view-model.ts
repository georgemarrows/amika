import type { KanjiReading } from "../../../shared/kanji-reading";
import type { SrsCardKind, SrsReviewCardResponse } from "../../../shared/srs";
import { labelSrsCardKind, labelSrsCardState } from "./srs-card-labels";

export type SrsReviewRatingViewModel = {
  id: "again" | "hard" | "good" | "easy";
  label: string;
};

export const srsReviewRatings: SrsReviewRatingViewModel[] = [
  { id: "again", label: "Again" },
  { id: "hard", label: "Hard" },
  { id: "good", label: "Good" },
  { id: "easy", label: "Easy" },
];

export type SrsReviewCardViewModel = {
  id: string;
  literal: string;
  kind: SrsCardKind;
  kindLabel: string;
  stateLabel: string;
  meaning: string;
  onReadings: KanjiReading[];
  kunReadings: KanjiReading[];
  otherReadings: KanjiReading[];
  words: SrsReviewCardResponse["words"];
  promptNote: string;
  isRecognition: boolean;
};

export function createSrsReviewCardViewModel(card: SrsReviewCardResponse): SrsReviewCardViewModel {
  const isRecognition = card.cardKind === "kanji_recognition";

  return {
    id: card.id,
    literal: card.kanjiLiteral,
    kind: card.cardKind,
    kindLabel: labelSrsCardKind(card.cardKind),
    stateLabel: `${labelSrsCardState(card.state)} · due now`,
    meaning: card.meaning,
    onReadings: card.readings.filter((reading) => reading.type === "on"),
    kunReadings: card.readings.filter((reading) => reading.type === "kun"),
    otherReadings: card.readings.filter((reading) => reading.type === "unknown"),
    words: card.words,
    promptNote: isRecognition
      ? "Name the readings and English meaning."
      : "Produce the kanji from the meaning and readings.",
    isRecognition,
  };
}
