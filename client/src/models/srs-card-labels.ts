import type { SrsCardKind, SrsCardState } from "../../../shared/srs";

export function labelSrsCardKind(cardKind: SrsCardKind) {
  return cardKind === "kanji_recognition" ? "Recognition" : "Production";
}

export function labelSrsCardState(state: SrsCardState) {
  switch (state) {
    case "new":
      return "new";
    case "learning":
      return "learning";
    case "review":
      return "";
    case "relearning":
      return "relearning";
  }
}
