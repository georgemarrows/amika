import { For } from "solid-js";

import type { PaneBodyProps } from "./pane-props";

export function HomePane(props: Pick<PaneBodyProps, "state" | "srsState" | "openPane">) {
  return (
    <>
      <div class="hero">
        <div class="home-title">こんにちは、George</div>
      </div>
      <div class="subtitle">{props.state.subtitle}</div>

      <button class="home-card review" type="button" onClick={() => props.openPane("review")}>
        <span class="h">Today's review</span>
        <span class="big jp">{props.srsState.dueCount()} cards due</span>
        <span class="meta">{props.state.review.summary}</span>
      </button>

      <button class="home-card" type="button" onClick={() => props.openPane("kanji:具")}>
        <span class="h">First imported kanji</span>
        <span class="big jp">具</span>
        <span class="meta">Kanji Damage · imported from SQLite</span>
      </button>

      <section class="section">
        <h4>Recently added</h4>
        <For each={props.state.recentAdditions}>
          {(item) => (
            <button
              class="feed-item"
              type="button"
              onClick={() => props.openPane("kanji:具")}
            >
              <span class="icon jp">{item.label.slice(0, 1)}</span>
              <span>
                <span class="feed-title jp">
                  {item.label} <span>{item.meta}</span>
                </span>
                <span class="feed-meta">prototype seed</span>
              </span>
            </button>
          )}
        </For>
      </section>

      <section class="section">
        <h4>Explore</h4>
        <button class="feed-item" type="button" onClick={() => props.openPane("kanji:具")}>
          <span class="icon jp">具</span>
          <span>
            <span class="feed-title">Imported kanji detail</span>
            <span class="feed-meta">tool · 8 strokes · Kanji Damage</span>
          </span>
        </button>
      </section>
    </>
  );
}
