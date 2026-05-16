import { createSignal, type Accessor } from "solid-js";

import { fetchSrsReviewQueue } from "../api";

export type SrsUiState = {
  dueCount: Accessor<number>;
  setDueCount: (count: number) => void;
  refreshDueCountFromQueue: () => Promise<void>;
};

export function createSrsUiState(initialDueCount: number): SrsUiState {
  const [dueCount, setDueCountSignal] = createSignal(initialDueCount);

  const setDueCount = (count: number) => {
    setDueCountSignal(Math.max(0, count));
  };

  return {
    dueCount,
    setDueCount,
    refreshDueCountFromQueue: async () => {
      const queue = await fetchSrsReviewQueue();
      setDueCount(queue.dueCount);
    },
  };
}
