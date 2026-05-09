import type { HomePageData } from "../../../shared/home-data";

export type HomePageViewModel = {
  reviewHeadline: string;
  latestSourceMeta: string;
  recentAdditionCount: number;
  explorationTitles: string[];
};

export function createHomePageViewModel(data: HomePageData): HomePageViewModel {
  return {
    reviewHeadline: `${data.review.dueCount} cards due`,
    latestSourceMeta: data.latestSource.meta,
    recentAdditionCount: data.recentAdditions.length,
    explorationTitles: data.explorationCards.map((item) => item.title),
  };
}
