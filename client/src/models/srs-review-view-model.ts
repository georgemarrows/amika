import type { KanjiReading } from "../../../shared/kanji-reading";
import type { SrsCardKind, SrsReviewCardResponse } from "../../../shared/srs";

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
    kindLabel: isRecognition ? "Recognition" : "Production",
    stateLabel: `${labelState(card.state)} · due now`,
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

export function labelState(state: SrsReviewCardResponse["state"]) {
  switch (state) {
    case "new":
      return "new";
    case "learning":
      return "learning";
    case "review":
      return "review";
    case "relearning":
      return "relearning";
  }
}
