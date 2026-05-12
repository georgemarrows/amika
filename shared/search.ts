export type SearchResultType = "kanji" | "word";

export type SearchTargetPaneKey = `kanji:${string}` | `word:${string}`;

export type SearchResultItem = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  targetPaneKey: SearchTargetPaneKey;
};

export type SearchResponse = {
  query: string;
  items: SearchResultItem[];
};
