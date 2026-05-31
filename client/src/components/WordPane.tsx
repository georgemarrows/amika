import { For, Match, Show, Switch, createResource } from "solid-js";

import { fetchWordDetail } from "../api";
import { createWordDetailViewModel } from "../models/word-detail-view-model";
import type { OpenPane } from "./pane-props";
import { PaneTitle } from "./standard/components";

export function WordPane(props: { id: string; openPane: OpenPane }) {
  const [detail] = createResource(() => props.id, fetchWordDetail);

  return (
    <Switch>
      <Match when={detail.error}>
        <div class="empty-state">
          <p class="status-label">Word unavailable</p>
          <h2>{props.id}</h2>
          <p>Re-run the Kanji Damage import for T-1010e and refresh.</p>
        </div>
      </Match>
      <Match when={detail.loading}>
        <div class="empty-state">
          <p class="status-label">Loading</p>
          <h2>{props.id}</h2>
        </div>
      </Match>
      <Match when={detail()}>
        {(loadedDetail) => {
          const model = createWordDetailViewModel(loadedDetail());

          return (
            <>
              <PaneTitle title={model.expression} />

              <div class="word-reading-large jp">{model.reading}</div>
              <div class="kanji-meaning">{model.primaryMeaning}</div>
              <div class="srs-btn">+ add to SRS</div>

              <section class="section">
                <h4>Metadata</h4>
                <div class="metadata-grid">
                  <div class="prop-row">
                    <div class="k">Usefulness</div>
                    <div class="v">{model.usefulness}</div>
                  </div>
                </div>
              </section>

              <section class="section">
                <h4>Meanings</h4>
                <Show when={model.meanings.length > 0} fallback={<div class="muted">No meanings imported.</div>}>
                  <div class="meaning-list">
                    <For each={model.meanings}>{(meaning) => <div class="meaning-row">{meaning}</div>}</For>
                  </div>
                </Show>
              </section>

              <section class="section">
                <h4>Kanji</h4>
                <Show when={model.kanji.length > 0} fallback={<div class="muted">No kanji links imported.</div>}>
                  <div class="kanji-chip-list">
                    <For each={model.kanji}>
                      {(kanji) => (
                        <button
                          class="kanji-chip"
                          type="button"
                          onClick={() => props.openPane(`kanji:${kanji.literal}`)}
                        >
                          <span class="jp">{kanji.literal}</span>
                          <span>{kanji.meaning ?? "Unknown"}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </section>
            </>
          );
        }}
      </Match>
    </Switch>
  );
}
