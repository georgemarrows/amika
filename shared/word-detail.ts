export type WordKanjiLink = {
  literal: string;
  meaning: string | null;
};

export type WordDetailResponse = {
  id: string;
  expression: string;
  reading: string | null;
  primaryMeaning: string | null;
  usefulness: string | null;
  meanings: string[];
  kanji: WordKanjiLink[];
};
