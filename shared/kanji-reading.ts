export type KanjiReadingType = "on" | "kun" | "unknown";

export type KanjiReading = {
  type: KanjiReadingType;
  reading: string;
  meaning: string | null;
  usefulness: string | null;
};
