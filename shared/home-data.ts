export type HomePageData = {
  title: string;
  subtitle: string;
  review: {
    dueCount: number;
    summary: string;
  };
  latestSource: {
    title: string;
    meta: string;
  };
  recentAdditions: Array<{
    label: string;
    meta: string;
  }>;
  explorationCards: Array<{
    title: string;
    description: string;
  }>;
};

export function getHomePageData(): HomePageData {
  return {
    title: "A personal Japanese workspace",
    subtitle: "Prototype-inspired scaffold: one simple home screen, one API, no pane navigation yet.",
    review: {
      dueCount: 0,
      summary: "Review queue updates from your local SRS data.",
    },
    latestSource: {
      title: "Lesson 12",
      meta: "22 new words, 8 still unreviewed.",
    },
    recentAdditions: [
      { label: "庭", meta: "garden" },
      { label: "植物", meta: "plant" },
      { label: "極端", meta: "extreme" },
    ],
    explorationCards: [
      {
        title: "Confusables to watch",
        description: "You keep circling similar-looking kanji; compare views will land in a later phase.",
      },
      {
        title: "Latest source",
        description: "The lesson ingest flow will turn this card into a real entry point.",
      },
    ],
  };
}
