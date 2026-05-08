import { createSignal, type Accessor } from "solid-js";

export const homePaneKey = "home";

export type PaneKey = typeof homePaneKey | `kanji:${string}` | "review" | "list-kanji";

export type PaneDescriptor = {
  key: PaneKey;
  title: string;
  pill: string;
  className?: string;
};

export type PaneState = {
  panes: Accessor<PaneKey[]>;
  openFromPane: (key: PaneKey, paneIndex: number) => void;
  openFromRoot: (key: PaneKey) => void;
  close: (key: PaneKey) => void;
  closeRightmost: () => void;
};

export function createInitialPaneKeys(): PaneKey[] {
  return [homePaneKey];
}

export function createPaneState(initialPanes: PaneKey[] = createInitialPaneKeys()): PaneState {
  const [panes, setPanes] = createSignal<PaneKey[]>(initialPanes);

  return {
    panes,
    openFromPane: (key, paneIndex) => setPanes((current) => openPane(current, key, paneIndex)),
    openFromRoot: (key) => setPanes((current) => openPane(current, key)),
    close: (key) => setPanes((current) => closePane(current, key)),
    closeRightmost: () => setPanes(closeRightmostPane),
  };
}

export function describePane(key: PaneKey): PaneDescriptor {
  if (key === "home") {
    return { key, title: "Home", pill: "home", className: "home" };
  }

  if (key === "review") {
    return { key, title: "Today's review", pill: "SRS" };
  }

  if (key === "list-kanji") {
    return { key, title: "All kanji", pill: "index" };
  }

  return { key, title: key.slice("kanji:".length), pill: "kanji" };
}

export function openPane(panes: PaneKey[], key: PaneKey, afterIndex: number | null = null): PaneKey[] {
  const keptPanes = afterIndex === null ? panes : panes.slice(0, afterIndex + 1);

  if (keptPanes.includes(key)) {
    return keptPanes;
  }

  return [...keptPanes, key];
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
