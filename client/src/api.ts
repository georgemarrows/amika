import type { HomePageData } from "../../shared/home-data";
import type { KanjiDetailResponse } from "../../shared/kanji-detail";
import type { WordDetailResponse } from "../../shared/word-detail";

export async function fetchHomePageData(): Promise<HomePageData> {
  const response = await fetch("/api/home");

  if (!response.ok) {
    throw new Error(`Failed to load home page data: ${response.status}`);
  }

  return response.json();
}

export async function fetchKanjiDetail(literal: string): Promise<KanjiDetailResponse> {
  const response = await fetch(`/api/kanji/${encodeURIComponent(literal)}`);

  if (!response.ok) {
    throw new Error(`Failed to load kanji detail: ${response.status}`);
  }

  return response.json();
}

export async function fetchWordDetail(id: string): Promise<WordDetailResponse> {
  const response = await fetch(`/api/words/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Failed to load word detail: ${response.status}`);
  }

  return response.json();
}
