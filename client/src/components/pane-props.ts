import type { HomePageData } from "../../../shared/home-data";
import type { PaneKey } from "../state/pane-state";
import type { SrsUiState } from "../state/srs-ui-state";

export type OpenPane = (key: PaneKey) => void;

export type PaneBodyProps = {
  paneKey: PaneKey;
  state: HomePageData;
  srsState: SrsUiState;
  openPane: OpenPane;
};
