import { For, Show, createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

import type { SearchResultItem, SearchTargetPaneKey } from "../../../shared/search";
import { fetchSearchResults } from "../api";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onOpenResult: (key: SearchTargetPaneKey) => void;
};

type SearchStatus = "idle" | "debouncing" | "loading-quiet" | "loading-visible" | "ready" | "empty" | "error";

type CommandPaletteStateProps = {
  open: Accessor<boolean>;
  onClose: () => void;
  onOpenResult: (key: SearchTargetPaneKey) => void;
};

function createCommandPaletteState(props: CommandPaletteStateProps) {
  const [query, setQuery] = createSignal("");
  const [items, setItems] = createSignal<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [status, setStatus] = createSignal<SearchStatus>("idle");
  const [isComposing, setIsComposing] = createSignal(false);

  createEffect(() => {
    if (!props.open()) {
      setQuery("");
      setItems([]);
      setActiveIndex(0);
      setStatus("idle");
      setIsComposing(false);
      return;
    }

    const currentQuery = query();

    if (currentQuery.trim() === "") {
      setItems([]);
      setActiveIndex(0);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    let spinnerTimeoutId: number | undefined;

    const clearSpinnerTimer = () => {
      if (spinnerTimeoutId === undefined) {
        return;
      }

      window.clearTimeout(spinnerTimeoutId);
      spinnerTimeoutId = undefined;
    };

    setStatus("debouncing");

    const timeoutId = window.setTimeout(() => {
      setStatus("loading-quiet");

      spinnerTimeoutId = window.setTimeout(() => {
        if (!controller.signal.aborted) {
          setStatus("loading-visible");
        }
      }, 300);

      void fetchSearchResults(currentQuery, controller.signal)
        .then((response) => {
          clearSpinnerTimer();
          setItems(response.items);
          setActiveIndex(0);
          setStatus(response.items.length === 0 ? "empty" : "ready");
        })
        .catch((searchError) => {
          if (searchError instanceof DOMException && searchError.name === "AbortError") {
            return;
          }

          clearSpinnerTimer();
          setItems([]);
          setActiveIndex(0);
          setStatus("error");
        });
    }, 80);

    onCleanup(() => {
      window.clearTimeout(timeoutId);
      clearSpinnerTimer();
      controller.abort();
    });
  });

  const close = () => {
    props.onClose();
  };

  const activateItem = (item: SearchResultItem | undefined) => {
    if (!item) {
      return;
    }

    props.onOpenResult(item.targetPaneKey);
    close();
  };

  const moveSelection = (delta: number) => {
    const currentItems = items();

    if (currentItems.length === 0) {
      return;
    }

    setActiveIndex((current) => (current + delta + currentItems.length) % currentItems.length);
  };

  const activateSelection = () => {
    activateItem(items()[activeIndex()]);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      if (event.isComposing || isComposing() || event.keyCode === 229) {
        return;
      }

      event.preventDefault();
      activateSelection();
    }
  };

  return {
    query,
    items,
    activeIndex,
    showSpinner: () => status() === "loading-visible",
    showIdleMessage: () => status() === "idle",
    showEmptyMessage: () => status() === "empty",
    showErrorMessage: () => status() === "error",
    updateQuery: setQuery,
    startComposition: () => setIsComposing(true),
    endComposition: () => setIsComposing(false),
    pointAtItem: setActiveIndex,
    activateItem,
    handleKeyDown,
  };
}

export function CommandPalette(props: CommandPaletteProps) {
  let inputElement: HTMLInputElement | undefined;
  const palette = createCommandPaletteState({
    open: () => props.open,
    onClose: props.onClose,
    onOpenResult: props.onOpenResult,
  });

  createEffect(() => {
    if (!props.open) {
      return;
    }

    queueMicrotask(() => inputElement?.focus());
  });

  const subtitle = (item: SearchResultItem) => (item.subtitle === "" ? "No meaning imported yet" : item.subtitle);
  const reading = (item: SearchResultItem) => {
    if (item.type !== "word" || item.subtitle === "") {
      return null;
    }

    return item.subtitle.split(" · ")[0] ?? null;
  };
  const meaning = (item: SearchResultItem) => {
    if (item.type !== "word") {
      return subtitle(item);
    }

    return item.subtitle.includes(" · ") ? item.subtitle.split(" · ").slice(1).join(" · ") : subtitle(item);
  };

  return (
    <Show when={props.open}>
      <div
        class="command-palette-backdrop"
        onClick={(event) => {
          if (event.currentTarget === event.target) {
            props.onClose();
          }
        }}
        onKeyDown={palette.handleKeyDown}
      >
        <section class="command-palette" aria-label="Search">
          <div class="command-search-row">
            <div class="command-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" />
              </svg>
            </div>
            <input
              ref={inputElement}
              value={palette.query()}
              onInput={(event) => palette.updateQuery(event.currentTarget.value)}
              onCompositionStart={palette.startComposition}
              onCompositionEnd={palette.endComposition}
              autocomplete="off"
              spellcheck={false}
              placeholder="Search kanji, words, readings, English..."
            />
            <Show when={palette.showSpinner()} fallback={<span class="kbd">⌘K</span>}>
              <span class="command-spinner" aria-label="Searching" />
            </Show>
          </div>

          <div class="command-results" aria-live="polite">
            <Show when={palette.showIdleMessage()}>
              <div class="command-empty">Type a query</div>
            </Show>

            <Show when={palette.showErrorMessage()}>
              <div class="command-empty">Search failed</div>
            </Show>

            <Show when={palette.showEmptyMessage()}>
              <div class="command-empty">No results</div>
            </Show>

            <For each={palette.items()}>
              {(item, index) => (
                <button
                  class={`command-result ${item.type} ${index() === palette.activeIndex() ? "active" : ""}`}
                  type="button"
                  onMouseEnter={() => palette.pointAtItem(index())}
                  onClick={() => palette.activateItem(item)}
                >
                  <span class="command-main">
                    <span class="command-title-line jp">
                      <span class={`command-title ${item.type}`}>{item.title}</span>
                      <Show when={reading(item)}>
                        {(wordReading) => <span class="command-reading jp">{wordReading()}</span>}
                      </Show>
                    </span>
                    <span class="command-subtitle">{meaning(item)}</span>
                  </span>
                  <span class="command-type">{item.type}</span>
                </button>
              )}
            </For>
          </div>
        </section>
      </div>
    </Show>
  );
}
