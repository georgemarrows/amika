import type { WordDetailResponse, WordKanjiLink } from "../../../shared/word-detail";

export type WordDetailViewModel = {
  id: string;
  expression: string;
  reading: string;
  primaryMeaning: string;
  usefulness: string;
  meanings: string[];
  kanji: WordKanjiLink[];
};

export function createWordDetailViewModel(detail: WordDetailResponse): WordDetailViewModel {
  return {
    id: detail.id,
    expression: detail.expression,
    reading: detail.reading ?? "Unknown",
    primaryMeaning: detail.primaryMeaning ?? "Unknown",
    usefulness: detail.usefulness ?? "Unknown",
    meanings: detail.meanings.length > 0 ? detail.meanings : detail.primaryMeaning ? [detail.primaryMeaning] : [],
    kanji: detail.kanji,
  };
}
