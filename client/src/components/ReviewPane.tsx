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
import { KanjiPane } from "./KanjiPane";
import type { OpenPane } from "./pane-props";
import { Columns, HorizontalRule } from "./helpers";
import { Badge, PaneTitle } from './standard/components'

type ReviewLogEntry = {
  literal: string;
  kindLabel: string;
  ratingLabel: string;
};

export function ReviewPane(props: {
  srsState: SrsUiState;
  openPane: OpenPane;
}) {
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
            <PaneTitle title="Review" secondary={<Badge>{loadedQueue().dueCount} due</Badge>} />

            <Switch>
              <Match when={currentCard()}>
                {(card) => (
                  <Switch>
                    <Match when={!revealed()}>
                      <ReviewKanjiCard
                        card={card()}
                        submitting={submitting()}
                        onReveal={() => setRevealed(true)}
                      />
                    </Match>
                    <Match when={true}>
                      <AnswerKanjiCard
                        card={card()}
                        openPane={props.openPane}
                        rate={rate}
                        srsState={props.srsState}
                        submitError={submitError()}
                        submitting={submitting()}
                      />
                    </Match>
                  </Switch>
                )}
              </Match>
              <Match when={true}>
                <ReviewLog entries={log()} />
              </Match>
            </Switch>
          </section>
        )}
      </Match>
    </Switch>
  );
}

function ReviewCardMeta(props: {
  card: ReturnType<typeof createSrsReviewCardViewModel>;
}) {
  return (
    <div class="review-card-meta">
      <div class="review-card-kind">{props.card.kindLabel}</div>
      <div class="review-card-schedule">{props.card.stateLabel}</div>
    </div>
  );
}

function ReviewKanjiCard(props: {
  card: ReturnType<typeof createSrsReviewCardViewModel>;
  submitting: boolean;
  onReveal: () => void;
}) {
  return (
    <article class="review-card live">
      <ReviewCardMeta card={props.card} />
      <div class="review-card-face">
        <Show
          when={props.card.isRecognition}
          fallback={
            <>
              <div class="meaning-prompt">{props.card.meaning}</div>
              <ReadingStack card={props.card} />
            </>
          }
        >
          <div class="kanji-prompt jp">{props.card.literal}</div>
        </Show>
        <div class="prompt-note">{props.card.promptNote}</div>
      </div>
      <div class="review-controls">
        <button
          class="review-btn primary"
          type="button"
          disabled={props.submitting}
          onClick={props.onReveal}
        >
          Reveal answer
        </button>
      </div>
    </article>
  );
}

function AnswerKanjiCard(props: {
  card: ReturnType<typeof createSrsReviewCardViewModel>;
  openPane: OpenPane;
  rate: (rating: SrsReviewRatingViewModel) => Promise<void>;
  srsState: SrsUiState;
  submitError: string | null;
  submitting: boolean;
}) {
  return (
    <section class="review-answer">
      <Columns gridTemplateColumns="repeat(4, 1fr)" gap="0.5rem">
        <For each={srsReviewRatings}>
          {(rating) => (
            <button
              class={`review-btn ${rating.id}`}
              type="button"
              disabled={props.submitting}
              onClick={() => void props.rate(rating)}
            >
              {rating.label}
            </button>
          )}
        </For>
      </Columns>
      <Show when={props.submitError}>
        {(message) => <div class="review-error">{message()}</div>}
      </Show>
      <HorizontalRule />
      <KanjiPane
        literal={props.card.literal}
        srsState={props.srsState}
        openPane={props.openPane}
        showSrsPanel={false}
      />
    </section>
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

function ReviewLog(props: { entries: ReviewLogEntry[] }) {
  return (
    <section class="review-summary">
      <h2>Review complete</h2>
      <p class="subtitle">No due SRS cards right now.</p>

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
    </section>
  );
}
