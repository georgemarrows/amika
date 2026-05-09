export type KanjiListItem = {
  literal: string;
  meaning: string;
  strokeCount: number | null;
  frequencyRank: number | null;
  usefulness: string | null;
};

export type WordListItem = {
  id: string;
  expression: string;
  reading: string | null;
  meaning: string | null;
  usefulness: string | null;
};

export type KanjiListResponse = {
  items: KanjiListItem[];
};

export type WordListResponse = {
  items: WordListItem[];
};
