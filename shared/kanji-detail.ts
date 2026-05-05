export type MediaAsset = {
  id: string;
  url: string;
  contentType: string | null;
};

export type KanjiDetailResponse = {
  literal: string;
  meaning: string;
  strokeCount: number | null;
  frequencyRank: number | null;
  usefulness: string | null;
  strokeOrderImage: MediaAsset | null;
  components: [];
  readings: [];
  mnemonics: [];
  words: [];
  relations: [];
};
