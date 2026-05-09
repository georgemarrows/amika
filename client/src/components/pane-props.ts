import type { HomePageData } from "../../../shared/home-data";
import type { PaneKey } from "../state/pane-state";

export type OpenFromPane = (key: PaneKey, paneIndex: number) => void;

export type PaneBodyProps = {
  paneKey: PaneKey;
  state: HomePageData;
  paneIndex: number;
  openFromPane: OpenFromPane;
};
