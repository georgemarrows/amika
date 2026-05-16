import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
} from "solid-js";

import { fetchSrsReviewQueue, submitSrsReview } from "../api";
import {
  createSrsReviewCardViewModel,
  srsReviewRatings,
  type SrsReviewRatingViewModel,
} from "../models/srs-review-view-model";
import type { SrsUiState } from "../state/srs-ui-state";

type ReviewLogEntry = {
  literal: string;
  kindLabel: string;
  ratingLabel: string;
};

export function ReviewPane(props: { srsState: SrsUiState }) {
  const [queue, { mutate }] = createResource(fetchSrsReviewQueue);
  const [revealed, setRevealed] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [log, setLog] = createSignal<ReviewLogEntry[]>([]);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  createEffect(() => {
    const loaded = queue();

    if (loaded) {
      props.srsState.setDueCount(loaded.dueCount);
    }
  });

  const currentCard = () => {
    const card = queue()?.card;

    return card ? createSrsReviewCardViewModel(card) : null;
  };

  const rate = async (rating: SrsReviewRatingViewModel) => {
    const card = currentCard();

    if (!card) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await submitSrsReview(card.id, rating.id);
      setLog((current) => [
        ...current,
        {
          literal: card.literal,
          kindLabel: card.kindLabel,
          ratingLabel: rating.label,
        },
      ]);
      props.srsState.setDueCount(response.dueCount);
      mutate({
        dueCount: response.dueCount,
        card: response.nextCard,
        generatedAt: new Date().toISOString(),
      });
      setRevealed(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Review submission failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Switch>
      <Match when={queue.error}>
        <div class="empty-state">
          <p class="status-label">Review unavailable</p>
          <h2>SRS queue failed to load.</h2>
          <p>Run migrations and refresh. No cards are loaded automatically.</p>
        </div>
      </Match>
      <Match when={queue.loading}>
        <div class="empty-state">
          <p class="status-label">Loading</p>
          <h2>Preparing review...</h2>
        </div>
      </Match>
      <Match when={queue()}>
        {(loadedQueue) => (
          <section class="review-shell">
            <div class="review-top">
              <div class="section-title">Review</div>
              <div class="review-progress">{loadedQueue().dueCount} due</div>
            </div>

            <Show
              when={currentCard()}
              fallback={
                <section class="review-summary">
                  <h2>Review complete</h2>
                  <p class="subtitle">No due SRS cards right now.</p>
                  <ReviewLog entries={log()} />
                </section>
              }
            >
              {(card) => (
                <article class="review-card live">
                  <div class="review-card-meta">
                    <div class="review-card-kind">{card().kindLabel}</div>
                    <div class="review-card-schedule">{card().stateLabel}</div>
                  </div>

                  <div class="review-card-face">
                    <Show
                      when={card().isRecognition}
                      fallback={
                        <>
                          <div class="meaning-prompt">{card().meaning}</div>
                          <ReadingStack card={card()} />
                        </>
                      }
                    >
                      <div class="kanji-prompt jp">{card().literal}</div>
                    </Show>
                    <div class="prompt-note">{card().promptNote}</div>

                    <Show when={revealed()}>
                      <AnswerPanel card={card()} />
                    </Show>
                  </div>

                  <Show when={submitError()}>
                    {(message) => <div class="review-error">{message()}</div>}
                  </Show>

                  <div class="review-controls">
                    <Show
                      when={revealed()}
                      fallback={
                        <button
                          class="review-btn primary"
                          type="button"
                          disabled={submitting()}
                          onClick={() => setRevealed(true)}
                        >
                          Reveal answer
                        </button>
                      }
                    >
                      <For each={srsReviewRatings}>
                        {(rating) => (
                          <button
                            class={`review-btn ${rating.id}`}
                            type="button"
                            disabled={submitting()}
                            onClick={() => void rate(rating)}
                          >
                            {rating.label}
                          </button>
                        )}
                      </For>
                    </Show>
                  </div>
                </article>
              )}
            </Show>
          </section>
        )}
      </Match>
    </Switch>
  );
}

function ReadingStack(props: {
  card: ReturnType<typeof createSrsReviewCardViewModel>;
}) {
  return (
    <div class="reading-stack">
      <For each={props.card.onReadings}>
        {(reading) => <span class="reading-chip jp on">{reading.reading}</span>}
      </For>
      <For each={props.card.kunReadings}>
        {(reading) => (
          <span class="reading-chip jp kun">{reading.reading}</span>
        )}
      </For>
      <For each={props.card.otherReadings}>
        {(reading) => <span class="reading-chip jp">{reading.reading}</span>}
      </For>
    </div>
  );
}

function AnswerPanel(props: {
  card: ReturnType<typeof createSrsReviewCardViewModel>;
}) {
  return (
    <div class="answer-panel">
      <div class="answer-grid">
        <div class="answer-label">
          {props.card.isRecognition ? "Meaning" : "Kanji"}
        </div>
        <div class={`answer-value ${props.card.isRecognition ? "" : "big jp"}`}>
          {props.card.isRecognition ? props.card.meaning : props.card.literal}
        </div>
        <div class="answer-label">Onyomi</div>
        <div class="answer-value jp">
          {props.card.onReadings.map((reading) => reading.reading).join(", ") ||
            "None"}
        </div>
        <div class="answer-label">Kunyomi</div>
        <div class="answer-value jp">
          {props.card.kunReadings
            .map((reading) => reading.reading)
            .join(", ") || "None"}
        </div>
        <div class="answer-label">Examples</div>
        <div class="answer-value">
          <Show
            when={props.card.words.length > 0}
            fallback="No examples imported."
          >
            <For each={props.card.words.slice(0, 4)}>
              {(word) => (
                <div>
                  <span class="jp">{word.expression}</span>{" "}
                  <span class="dim jp">{word.reading ?? "Unknown"}</span> -{" "}
                  {word.meaning ?? "Unknown"}
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

function ReviewLog(props: { entries: ReviewLogEntry[] }) {
  return (
    <Show when={props.entries.length > 0}>
      <div class="review-log">
        <For each={props.entries}>
          {(entry) => (
            <div class="review-log-row">
              <span class="jp">{entry.literal}</span>
              <span>{entry.kindLabel}</span>
              <span>{entry.ratingLabel}</span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
