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
        paneIndex={props.paneIndex}
        openFromPane={props.openFromPane}
      />
    );
  }

  if (props.paneKey === "review") {
    return <ReviewPane srsState={props.srsState} />;
  }

  if (props.paneKey === "srs-status") {
    return <SrsStatusPane paneIndex={props.paneIndex} openFromPane={props.openFromPane} />;
  }

  if (props.paneKey === "list-kanji") {
    return <KanjiListPane paneIndex={props.paneIndex} openFromPane={props.openFromPane} />;
  }

  if (props.paneKey === "list-words") {
    return <WordListPane paneIndex={props.paneIndex} openFromPane={props.openFromPane} />;
  }

  if (props.paneKey.startsWith("word:")) {
    return (
      <WordPane
        id={props.paneKey.slice("word:".length)}
        paneIndex={props.paneIndex}
        openFromPane={props.openFromPane}
      />
    );
  }

  return (
      <KanjiPane
        literal={props.paneKey.slice("kanji:".length)}
        srsState={props.srsState}
        paneIndex={props.paneIndex}
        openFromPane={props.openFromPane}
    />
  );
}
