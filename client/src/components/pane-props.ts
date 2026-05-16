import type { HomePageData } from "../../../shared/home-data";
import type { PaneKey } from "../state/pane-state";
import type { SrsUiState } from "../state/srs-ui-state";

export type OpenFromPane = (key: PaneKey, paneIndex: number) => void;

export type PaneBodyProps = {
  paneKey: PaneKey;
  state: HomePageData;
  srsState: SrsUiState;
  paneIndex: number;
  openFromPane: OpenFromPane;
};
