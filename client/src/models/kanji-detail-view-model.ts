import type { KanjiDetailResponse, KanjiWordSummary, MediaAsset } from "../../../shared/kanji-detail";
import type { KanjiReading } from "../../../shared/kanji-reading";

export type KanjiMetadataItem = {
  label: string;
  value: string;
};

export type KanjiDetailViewModel = {
  literal: string;
  meaning: string;
  metadata: KanjiMetadataItem[];
  strokeOrderImage: MediaAsset | null;
  readingGroups: Array<{
    label: string;
    readings: KanjiReading[];
  }>;
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
    readingGroups: [
      { label: "On", readings: detail.readings.filter((reading) => reading.type === "on") },
      { label: "Kun", readings: detail.readings.filter((reading) => reading.type === "kun") },
      { label: "Other", readings: detail.readings.filter((reading) => reading.type === "unknown") },
    ].filter((group) => group.readings.length > 0),
    words: detail.words,
    emptyFutureSections: "Components, mnemonics, and relations are not imported for this entry yet.",
  };
}
