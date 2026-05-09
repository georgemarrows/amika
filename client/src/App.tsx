import { For, Match, Show, Switch, createEffect, createResource, onCleanup, onMount } from "solid-js";

import type { HomePageData } from "../../shared/home-data";
import type { KanjiDetailResponse } from "../../shared/kanji-detail";
import type { WordDetailResponse } from "../../shared/word-detail";
import { createKanjiDetailViewModel } from "./kanji-detail-view-model";
import {
  type PaneKey,
  createPaneState,
  describePane,
} from "./pane-state";
import { createWordDetailViewModel } from "./word-detail-view-model";

async function fetchHomePageData(): Promise<HomePageData> {
  const response = await fetch("/api/home");

  if (!response.ok) {
    throw new Error(`Failed to load home page data: ${response.status}`);
  }

  return response.json();
}

async function fetchKanjiDetail(literal: string): Promise<KanjiDetailResponse> {
  const response = await fetch(`/api/kanji/${encodeURIComponent(literal)}`);

  if (!response.ok) {
    throw new Error(`Failed to load kanji detail: ${response.status}`);
  }

  return response.json();
}

async function fetchWordDetail(id: string): Promise<WordDetailResponse> {
  const response = await fetch(`/api/words/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Failed to load word detail: ${response.status}`);
  }

  return response.json();
}

type PaneBodyProps = {
  paneKey: PaneKey;
  state: HomePageData;
  paneIndex: number;
  openFromPane: (key: PaneKey, paneIndex: number) => void;
};

function HomePane(props: Pick<PaneBodyProps, "state" | "paneIndex" | "openFromPane">) {
  return (
    <>
      <div class="hero">
        <div class="home-title">こんにちは、George</div>
      </div>
      <div class="subtitle">{props.state.subtitle}</div>

      <button class="home-card review" type="button" onClick={() => props.openFromPane("review", props.paneIndex)}>
        <span class="h">Today's review</span>
        <span class="big jp">{props.state.review.dueCount} cards due</span>
        <span class="meta">{props.state.review.summary}</span>
      </button>

      <button class="home-card" type="button" onClick={() => props.openFromPane("kanji:具", props.paneIndex)}>
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
              onClick={() => props.openFromPane("kanji:具", props.paneIndex)}
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
        <button class="feed-item" type="button" onClick={() => props.openFromPane("kanji:具", props.paneIndex)}>
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

function ReviewPane() {
  return (
    <>
      <div class="hero">
        <div class="section-title">Review</div>
      </div>
      <div class="subtitle">SRS review flow lands in a later task.</div>
      <section class="review-card">
        <div class="prompt jp">具</div>
        <div class="answer">First imported kanji is available as a detail pane.</div>
      </section>
    </>
  );
}

function KanjiListPane(props: Pick<PaneBodyProps, "paneIndex" | "openFromPane">) {
  return (
    <>
      <div class="hero">
        <div class="section-title">Kanji · 1</div>
      </div>
      <table class="dict">
        <tbody>
          <tr onClick={() => props.openFromPane("kanji:具", props.paneIndex)}>
            <td class="jp glyph-cell">具</td>
            <td>tool</td>
            <td class="r">imported</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function KanjiPane(props: { literal: string; paneIndex: number; openFromPane: (key: PaneKey, paneIndex: number) => void }) {
  const [detail] = createResource(() => props.literal, fetchKanjiDetail);

  return (
    <Switch>
      <Match when={detail.error}>
        <div class="empty-state">
          <p class="status-label">Kanji unavailable</p>
          <h2 class="jp">{props.literal}</h2>
          <p>Run the existing migrate/import flow for T-1010a and refresh. No data is imported automatically.</p>
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
                    fallback={<div class="stroke-placeholder">No stroke order image imported.</div>}
                  >
                    {(image) => <img src={image().url} alt={`${model.literal} stroke order`} />}
                  </Show>
                </div>
              </section>

              <section class="section">
                <h4>Words</h4>
                <Show when={model.words.length > 0} fallback={<div class="muted">No words imported for this kanji yet.</div>}>
                  <div class="word-list">
                    <For each={model.words}>
                      {(word) => (
                        <button
                          class="word-row"
                          type="button"
                          onClick={() => props.openFromPane(`word:${word.id}`, props.paneIndex)}
                        >
                          <span>
                            <span class="jp word-expression">{word.expression}</span>
                            <span class="jp word-reading">{word.reading ?? "Unknown"}</span>
                          </span>
                          <span class="word-meaning">{word.meaning ?? "Unknown"}</span>
                          <Show when={word.usefulness}>
                            {(usefulness) => <span class="word-stars">{usefulness()}</span>}
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

function WordPane(props: { id: string; paneIndex: number; openFromPane: (key: PaneKey, paneIndex: number) => void }) {
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
              <div class="hero">
                <div class="section-title jp">{model.expression}</div>
              </div>
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
                          onClick={() => props.openFromPane(`kanji:${kanji.literal}`, props.paneIndex)}
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

function PaneBody(props: PaneBodyProps) {
  if (props.paneKey === "home") {
    return <HomePane state={props.state} paneIndex={props.paneIndex} openFromPane={props.openFromPane} />;
  }

  if (props.paneKey === "review") {
    return <ReviewPane />;
  }

  if (props.paneKey === "list-kanji") {
    return <KanjiListPane paneIndex={props.paneIndex} openFromPane={props.openFromPane} />;
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
      paneIndex={props.paneIndex}
      openFromPane={props.openFromPane}
    />
  );
}

function PaneShell(props: { state: HomePageData }) {
  let panesElement: HTMLDivElement | undefined;
  const paneState = createPaneState();

  onMount(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        paneState.closeRightmost();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    onCleanup(() => window.removeEventListener("keydown", closeOnEscape));
  });

  createEffect(() => {
    paneState.panes();
    queueMicrotask(() => panesElement?.lastElementChild?.scrollIntoView({ inline: "end", behavior: "smooth" }));
  });

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <div class="logo">
          Amika <span class="logo-jp">網化</span>
        </div>

        <nav class="nav">
          <button class="nav-item" type="button" onClick={() => paneState.openFromRoot("home")}>
            Home
          </button>
          <button class="nav-item" type="button" onClick={() => paneState.openFromRoot("review")}>
            <span>Review</span>
            <span class="badge">{props.state.review.dueCount}</span>
          </button>
          <button class="nav-item nav-item-dim" type="button">
            Search <span class="kbd">⌘K</span>
          </button>
          <div class="nav-section">Library</div>
          <button class="nav-item nav-item-dim" type="button">
            Words
          </button>
          <button class="nav-item" type="button" onClick={() => paneState.openFromRoot("list-kanji")}>
            Kanji
          </button>
          <button class="nav-item nav-item-dim" type="button">
            Grammar
          </button>
          <button class="nav-item nav-item-dim" type="button">
            Texts
          </button>
        </nav>
      </aside>

      <main class="panes" ref={panesElement}>
        <For each={paneState.panes()}>
          {(paneKey, index) => {
            const descriptor = describePane(paneKey);

            return (
              <section class={`pane ${descriptor.className ?? ""}`}>
                <header class="pane-head">
                  <div class="title">
                    <span class="pill">{descriptor.pill}</span>
                    <span class="jp">{descriptor.title}</span>
                  </div>
                  <button class="close" type="button" onClick={() => paneState.close(paneKey)}>
                    ×
                  </button>
                </header>
                <div class="pane-body">
                  <PaneBody
                    paneKey={paneKey}
                    state={props.state}
                    paneIndex={index()}
                    openFromPane={paneState.openFromPane}
                  />
                </div>
              </section>
            );
          }}
        </For>
      </main>
    </div>
  );
}

export function App() {
  const [data] = createResource(fetchHomePageData);

  return (
    <Switch>
      <Match when={data.error}>
        <main class="status-shell">
          <section class="status-card">
            <p class="status-label">Server error</p>
            <h1>Home data failed to load.</h1>
            <p>
              Start the server with <code>bun run dev:server</code> and refresh.
            </p>
          </section>
        </main>
      </Match>
      <Match when={data.loading}>
        <main class="status-shell">
          <section class="status-card">
            <p class="status-label">Loading</p>
            <h1>Preparing your workspace...</h1>
          </section>
        </main>
      </Match>
      <Match when={data()}>
        {(state) => <PaneShell state={state()} />}
      </Match>
    </Switch>
  );
}
