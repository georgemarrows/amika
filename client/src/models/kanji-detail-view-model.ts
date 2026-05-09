import type { KanjiDetailResponse, KanjiWordSummary, MediaAsset } from "../../../shared/kanji-detail";

export type KanjiMetadataItem = {
  label: string;
  value: string;
};

export type KanjiDetailViewModel = {
  literal: string;
  meaning: string;
  metadata: KanjiMetadataItem[];
  strokeOrderImage: MediaAsset | null;
  words: KanjiWordSummary[];
  emptyFutureSections: string;
};

export function createKanjiDetailViewModel(detail: KanjiDetailResponse): KanjiDetailViewModel {
  const metadata: KanjiMetadataItem[] = [
    { label: "Strokes", value: detail.strokeCount === null ? "Unknown" : String(detail.strokeCount) },
    { label: "Usefulness", value: detail.usefulness ?? "Unknown" },
    { label: "Frequency", value: detail.frequencyRank === null ? "Unknown" : `#${detail.frequencyRank}` },
  ];

  return {
    literal: detail.literal,
    meaning: detail.meaning,
    metadata,
    strokeOrderImage: detail.strokeOrderImage,
    words: detail.words,
    emptyFutureSections: "Readings, components, mnemonics, and relations are not imported for this entry yet.",
  };
}
