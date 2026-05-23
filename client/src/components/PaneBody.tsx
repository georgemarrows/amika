import { HomePane } from "./HomePane";
import { KanjiListPane } from "./KanjiListPane";
import { KanjiPane } from "./KanjiPane";
import { ReviewPane } from "./ReviewPane";
import { SrsStatusPane } from "./SrsStatusPane";
import { WordListPane } from "./WordListPane";
import { WordPane } from "./WordPane";
import type { PaneBodyProps } from "./pane-props";

export function PaneBody(props: PaneBodyProps) {
  if (props.paneKey === "home") {
    return (
      <HomePane
        state={props.state}
        srsState={props.srsState}
        openPane={props.openPane}
      />
    );
  }

  if (props.paneKey === "review") {
    return (
      <ReviewPane
        srsState={props.srsState}
        openPane={props.openPane}
      />
    );
  }

  if (props.paneKey === "srs-status") {
    return <SrsStatusPane openPane={props.openPane} />;
  }

  if (props.paneKey === "list-kanji") {
    return <KanjiListPane openPane={props.openPane} />;
  }

  if (props.paneKey === "list-words") {
    return <WordListPane openPane={props.openPane} />;
  }

  if (props.paneKey.startsWith("word:")) {
    return (
      <WordPane
        id={props.paneKey.slice("word:".length)}
        openPane={props.openPane}
      />
    );
  }

  return (
    <KanjiPane
      literal={props.paneKey.slice("kanji:".length)}
      srsState={props.srsState}
      openPane={props.openPane}
    />
  );
}
