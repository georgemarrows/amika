import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { fetchKanjiDetail, setKanjiSrsEnabled } from "../api";
import {
  createKanjiDetailViewModel,
  type KanjiDetailViewModel,
} from "../models/kanji-detail-view-model";
import type { SrsUiState } from "../state/srs-ui-state";
import type { OpenFromPane } from "./pane-props";

type KanjiSrsPanelProps = {
  srs: KanjiDetailViewModel["srs"];
  pending: boolean;
  error: string | null;
  onToggle: (enabled: boolean) => void;
};


export function KanjiPane(props: {
  literal: string;
  srsState: SrsUiState;
  paneIndex: number;
  openFromPane: OpenFromPane;
}) {
  const [detail, { mutate }] = createResource(
    () => props.literal,
    fetchKanjiDetail,
  );
  const [srsPending, setSrsPending] = createSignal(false);
  const [srsError, setSrsError] = createSignal<string | null>(null);

  const toggleSrs = async (enabled: boolean) => {
    const current = detail();

    if (!current) {
      return;
    }

    setSrsPending(true);
    setSrsError(null);

    try {
      const srs = await setKanjiSrsEnabled(current.literal, enabled);
      props.srsState.setDueCount(srs.dueCount);
      mutate({ ...current, srs });
    } catch (error) {
      setSrsError(
        error instanceof Error ? error.message : "SRS status update failed.",
      );
    } finally {
      setSrsPending(false);
    }
  };

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
              <KanjiSrsPanel
                srs={model.srs}
                pending={srsPending()}
                error={srsError()}
                onToggle={(enabled) => void toggleSrs(enabled)}
              />
              <KanjiReadingsSection readingGroups={model.readingGroups} />
              <KanjiMetadataSection metadata={model.metadata} />
              <KanjiStrokeOrderSection
                literal={model.literal}
                strokeCount={model.metadata[0]?.value}
                image={model.strokeOrderImage}
              />
              <KanjiWordsSection
                words={model.words}
                paneIndex={props.paneIndex}
                openFromPane={props.openFromPane}
              />
              <KanjiFutureDetailsSection
                emptyFutureSections={model.emptyFutureSections}
              />
            </>
          );
        }}
      </Match>
    </Switch>
  );
}


function KanjiSrsHeader(props: {
  statusLabel: string;
  buttonLabel: string;
  buttonDisabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div class="kanji-srs-header">
      <div>
        <div class="kanji-srs-status">{props.statusLabel}</div>
      </div>
      <button
        class="srs-btn"
        type="button"
        disabled={props.buttonDisabled}
        onClick={props.onToggle}
      >
        {props.buttonLabel}
      </button>
    </div>
  );
}

function KanjiSrsPanel(props: KanjiSrsPanelProps) {
  return (
    <section class="kanji-srs-panel">
      <KanjiSrsHeader
        statusLabel={props.srs.statusLabel}
        buttonLabel={props.pending ? "Updating..." : props.srs.actionLabel}
        buttonDisabled={props.pending}
        onToggle={() => props.onToggle(!props.srs.enabled)}
      />
      <Show when={props.error}>
        {(message) => <div class="review-error">{message()}</div>}
      </Show>
      <Show when={props.srs.cards.length > 0}>
        <div class="kanji-srs-card-list">
          <For each={props.srs.cards}>
            {(card) => (
              <div
                class={`kanji-srs-card ${card.enabled ? "enabled" : "disabled"}`}
              >
                <span>{card.label}</span>
                <span>{card.stateLabel}</span>
                <span>{card.dueLabel}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}

function KanjiReadingsSection(props: {
  readingGroups: KanjiDetailViewModel["readingGroups"];
}) {
  return (
    <Show when={props.readingGroups.length > 0}>
      <section class="section">
        <h4>Readings</h4>
        <div class="reading-group-list">
          <For each={props.readingGroups}>
            {(group) => (
              <div class="reading-group">
                <div class="reading-label">{group.label}</div>
                <div class="reading-list">
                  <For each={group.readings}>
                    {(reading) => (
                      <div class="reading-row">
                        <span class="jp reading-text">{reading.reading}</span>
                        <Show when={reading.meaning}>
                          {(meaning) => (
                            <span class="reading-meaning">{meaning()}</span>
                          )}
                        </Show>
                        <Show when={reading.usefulness}>
                          {(usefulness) => (
                            <span class="word-stars">{usefulness()}</span>
                          )}
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </section>
    </Show>
  );
}

function KanjiMetadataSection(props: { metadata: KanjiDetailViewModel["metadata"] }) {
  return (
    <section class="section">
      <h4>Metadata</h4>
      <div class="metadata-grid">
        <For each={props.metadata}>
          {(item) => (
            <div class="prop-row">
              <div class="k">{item.label}</div>
              <div class="v">{item.value}</div>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

function KanjiStrokeOrderSection(props: {
  literal: string;
  strokeCount: string | undefined;
  image: KanjiDetailViewModel["strokeOrderImage"];
}) {
  return (
    <section class="section">
      <h4>Stroke order ({props.strokeCount})</h4>
      <div class="stroke-order">
        <Show
          when={props.image}
          fallback={
            <div class="stroke-placeholder">No stroke order image imported.</div>
          }
        >
          {(image) => (
            <img src={image().url} alt={`${props.literal} stroke order`} />
          )}
        </Show>
      </div>
    </section>
  );
}

function KanjiWordsSection(props: {
  words: KanjiDetailViewModel["words"];
  paneIndex: number;
  openFromPane: OpenFromPane;
}) {
  return (
    <section class="section">
      <h4>Words</h4>
      <Show
        when={props.words.length > 0}
        fallback={<div class="muted">No words imported for this kanji yet.</div>}
      >
        <div class="word-list">
          <For each={props.words}>
            {(word) => (
              <button
                class="word-row"
                type="button"
                onClick={() =>
                  props.openFromPane(`word:${word.id}`, props.paneIndex)
                }
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
  );
}

function KanjiFutureDetailsSection(props: { emptyFutureSections: string }) {
  return (
    <section class="section">
      <h4>Next details</h4>
      <div class="mnemonic">{props.emptyFutureSections}</div>
    </section>
  );
}