import type { KanjiReading } from "./kanji-reading.js";

export type MediaAsset = {
  id: string;
  url: string;
  contentType: string | null;
};

export type KanjiWordSummary = {
  id: string;
  expression: string;
  reading: string | null;
  meaning: string | null;
  usefulness: string | null;
};

export type KanjiDetailResponse = {
  literal: string;
  meaning: string;
  strokeCount: number | null;
  frequencyRank: number | null;
  usefulness: string | null;
  strokeOrderImage: MediaAsset | null;
  components: [];
  readings: KanjiReading[];
  mnemonics: [];
  words: KanjiWordSummary[];
  relations: [];
};
