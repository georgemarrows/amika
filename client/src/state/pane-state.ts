import { createSignal, type Accessor } from "solid-js";

export const homePaneKey = "home";

export type PaneKey =
  | typeof homePaneKey
  | `kanji:${string}`
  | `word:${string}`
  | "review"
  | "srs-status"
  | "list-kanji"
  | "list-words";

export type PaneDescriptor = {
  key: PaneKey;
  className?: string;
};

export type PaneState = {
  panes: Accessor<PaneKey[]>;
  scrollTarget: Accessor<PaneScrollTarget>;
  openFromPane: (key: PaneKey, paneIndex: number) => void;
  openFromRoot: (key: PaneKey) => void;
  close: (key: PaneKey) => void;
  closeRightmost: () => void;
};

export type PaneScrollTarget = {
  key: PaneKey;
  requestId: number;
  flash: boolean;
};

export function createInitialPaneKeys(): PaneKey[] {
  return [homePaneKey];
}

export function createPaneState(initialPanes: PaneKey[] = createInitialPaneKeys()): PaneState {
  const [panes, setPanes] = createSignal<PaneKey[]>(initialPanes);
  const [scrollTarget, setScrollTarget] = createSignal<PaneScrollTarget>({
    key: initialPanes.at(-1) ?? homePaneKey,
    requestId: 0,
    flash: false,
  });

  const requestScrollTo = (key: PaneKey, flash = false) => {
    setScrollTarget((current) => ({ key, requestId: current.requestId + 1, flash }));
  };

  return {
    panes,
    scrollTarget,
    openFromPane: (key, paneIndex) => {
      let shouldFlash = false;

      setPanes((current) => {
        shouldFlash = willScrollToExistingPane(current, key, paneIndex);
        return openPane(current, key, paneIndex);
      });
      requestScrollTo(key, shouldFlash);
    },
    openFromRoot: (key) => {
      setPanes(openRootPane(key));
      requestScrollTo(key);
    },
    close: (key) => setPanes((current) => closePane(current, key)),
    closeRightmost: () => setPanes(closeRightmostPane),
  };
}

export function describePane(key: PaneKey): PaneDescriptor {
  if (key === "home") {
    return { key, className: "home" };
  }

  if (key === "srs-status") {
    return { key, className: "srs-status-pane" };
  }

  return { key };
}

export function openPane(panes: PaneKey[], key: PaneKey, afterIndex: number | null = null): PaneKey[] {
  const keptPanes = afterIndex === null ? panes : panes.slice(0, afterIndex + 1);

  if (keptPanes.includes(key)) {
    return keptPanes;
  }

  return [...keptPanes, key];
}

export function openRootPane(key: PaneKey): PaneKey[] {
  return [key];
}

export function willScrollToExistingPane(panes: PaneKey[], key: PaneKey, afterIndex: number | null = null): boolean {
  const keptPanes = afterIndex === null ? panes : panes.slice(0, afterIndex + 1);

  return keptPanes.includes(key);
}

export function closePane(panes: PaneKey[], key: PaneKey): PaneKey[] {
  if (panes.length === 1) {
    return panes;
  }

  const nextPanes = panes.filter((paneKey) => paneKey !== key);

  return nextPanes.length > 0 ? nextPanes : createInitialPaneKeys();
}

export function closeRightmostPane(panes: PaneKey[]): PaneKey[] {
  if (panes.length <= 1) {
    return panes;
  }

  return panes.slice(0, -1);
}
