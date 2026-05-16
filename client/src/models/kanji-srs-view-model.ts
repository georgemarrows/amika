import type { KanjiSrsStatusResponse, SrsCardSummary } from "../../../shared/srs";
import { labelState } from "./srs-review-view-model";

export type KanjiSrsCardViewModel = {
  id: string;
  label: string;
  stateLabel: string;
  dueLabel: string;
  enabled: boolean;
};

export type KanjiSrsViewModel = {
  enabled: boolean;
  statusLabel: string;
  actionLabel: string;
  cards: KanjiSrsCardViewModel[];
};

export function createKanjiSrsViewModel(srs: KanjiSrsStatusResponse): KanjiSrsViewModel {
  return {
    enabled: srs.enabled,
    statusLabel: srs.enabled ? "In SRS" : "Not in SRS",
    actionLabel: srs.enabled ? "Remove from SRS" : "+ add to SRS",
    cards: srs.cards.map(toCardViewModel).sort((left, right) => left.label.localeCompare(right.label)),
  };
}

function toCardViewModel(card: SrsCardSummary): KanjiSrsCardViewModel {
  return {
    id: card.id,
    label: card.cardKind === "kanji_recognition" ? "Recognition" : "Production",
    stateLabel: card.enabled ? labelState(card.state) : "disabled",
    dueLabel: formatDue(card.dueAt),
    enabled: card.enabled,
  };
}

function formatDue(dueAt: string) {
  const due = new Date(dueAt);

  if (Number.isNaN(due.getTime())) {
    return "due unknown";
  }

  return `due ${due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}
