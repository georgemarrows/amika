import type { HomePageData } from "../../shared/home-data";
import type { KanjiDetailResponse } from "../../shared/kanji-detail";
import type { KanjiListResponse, WordListResponse } from "../../shared/library-list";
import type { SearchResponse } from "../../shared/search";
import type {
  KanjiSrsStatusResponse,
  SrsReviewQueueResponse,
  SrsReviewRating,
  SrsReviewSubmitResponse,
} from "../../shared/srs";
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

export async function fetchKanjiList(): Promise<KanjiListResponse> {
  const response = await fetch("/api/kanji");

  if (!response.ok) {
    throw new Error(`Failed to load kanji list: ${response.status}`);
  }

  return response.json();
}

export async function fetchWordList(): Promise<WordListResponse> {
  const response = await fetch("/api/words");

  if (!response.ok) {
    throw new Error(`Failed to load word list: ${response.status}`);
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

export async function fetchSearchResults(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load search results: ${response.status}`);
  }

  return response.json();
}

export async function fetchSrsReviewQueue(): Promise<SrsReviewQueueResponse> {
  const response = await fetch("/api/srs/review");

  if (!response.ok) {
    throw new Error(`Failed to load SRS review queue: ${response.status}`);
  }

  return response.json();
}

export async function submitSrsReview(cardId: string, rating: SrsReviewRating): Promise<SrsReviewSubmitResponse> {
  const response = await fetch("/api/srs/reviews", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ cardId, rating }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit SRS review: ${response.status}`);
  }

  return response.json();
}

export async function setKanjiSrsEnabled(literal: string, enabled: boolean): Promise<KanjiSrsStatusResponse> {
  const response = await fetch(`/api/kanji/${encodeURIComponent(literal)}/srs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update kanji SRS status: ${response.status}`);
  }

  return response.json();
}
