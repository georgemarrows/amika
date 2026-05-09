import { For, Match, Show, Switch, createResource } from "solid-js";

import { fetchKanjiDetail } from "../api";
import { createKanjiDetailViewModel } from "../models/kanji-detail-view-model";
import type { OpenFromPane } from "./pane-props";

export function KanjiPane(props: {
  literal: string;
  paneIndex: number;
  openFromPane: OpenFromPane;
}) {
  const [detail] = createResource(() => props.literal, fetchKanjiDetail);

  return (
    <Switch>
      <Match when={detail.error}>
        <div class="empty-state">
          <p class="status-label">Kanji unavailable</p>
          <h2 class="jp">{props.literal}</h2>
          <p>
            Run the migrate/import flow and refresh. No data is imported
            automatically.
          </p>
        </div>
      </Match>
      <Match when={detail.loading}>
        <div class="empty-state">
          <p class="status-label">Loading</p>
          <h2 class="jp">{props.literal}</h2>
        </div>
      </Match>
      <Match when={detail()}>
        {(loadedDetail) => {
          const model = createKanjiDetailViewModel(loadedDetail());

          return (
            <>
              <div class="hero">
                <div class="glyph jp">{model.literal}</div>
              </div>
              <div class="kanji-meaning">{model.meaning}</div>
              <div class="srs-btn">+ add to SRS</div>

              <section class="section">
                <h4>Metadata</h4>
                <div class="metadata-grid">
                  <For each={model.metadata}>
                    {(item) => (
                      <div class="prop-row">
                        <div class="k">{item.label}</div>
                        <div class="v">{item.value}</div>
                      </div>
                    )}
                  </For>
                </div>
              </section>

              <section class="section">
                <h4>Stroke order ({model.metadata[0]?.value})</h4>
                <div class="stroke-order">
                  <Show
                    when={model.strokeOrderImage}
                    fallback={
                      <div class="stroke-placeholder">
                        No stroke order image imported.
                      </div>
                    }
                  >
                    {(image) => (
                      <img
                        src={image().url}
                        alt={`${model.literal} stroke order`}
                      />
                    )}
                  </Show>
                </div>
              </section>

              <section class="section">
                <h4>Words</h4>
                <Show
                  when={model.words.length > 0}
                  fallback={
                    <div class="muted">
                      No words imported for this kanji yet.
                    </div>
                  }
                >
                  <div class="word-list">
                    <For each={model.words}>
                      {(word) => (
                        <button
                          class="word-row"
                          type="button"
                          onClick={() =>
                            props.openFromPane(
                              `word:${word.id}`,
                              props.paneIndex,
                            )
                          }
                        >
                          <span>
                            <span class="jp word-expression">
                              {word.expression}
                            </span>
                            <span class="jp word-reading">
                              {word.reading ?? "Unknown"}
                            </span>
                          </span>
                          <span class="word-meaning">
                            {word.meaning ?? "Unknown"}
                          </span>
                          <Show when={word.usefulness}>
                            {(usefulness) => (
                              <span class="word-stars">{usefulness()}</span>
                            )}
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </section>

              <section class="section">
                <h4>Next details</h4>
                <div class="mnemonic">{model.emptyFutureSections}</div>
              </section>
            </>
          );
        }}
      </Match>
    </Switch>
  );
}
