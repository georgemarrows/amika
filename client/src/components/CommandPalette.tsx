import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";

import type { SearchResultItem, SearchTargetPaneKey } from "../../../shared/search";
import { fetchSearchResults } from "../api";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onOpenResult: (key: SearchTargetPaneKey) => void;
};

export function CommandPalette(props: CommandPaletteProps) {
  let inputElement: HTMLInputElement | undefined;
  const [query, setQuery] = createSignal("");
  const [items, setItems] = createSignal<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [showSpinner, setShowSpinner] = createSignal(false);
  const [isComposing, setIsComposing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (!props.open) {
      return;
    }

    queueMicrotask(() => inputElement?.focus());
  });

  createEffect(() => {
    if (!props.open) {
      setQuery("");
      setItems([]);
      setActiveIndex(0);
      setLoading(false);
      setShowSpinner(false);
      setIsComposing(false);
      setError(null);
      return;
    }

    const currentQuery = query();

    if (currentQuery.trim() === "") {
      setItems([]);
      setActiveIndex(0);
      setLoading(false);
      setShowSpinner(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let spinnerTimeoutId: number | undefined;

    setLoading(true);
    setShowSpinner(false);
    setError(null);

    const timeoutId = window.setTimeout(() => {
      spinnerTimeoutId = window.setTimeout(() => {
        if (!controller.signal.aborted) {
          setShowSpinner(true);
        }
      }, 300);

      void fetchSearchResults(currentQuery, controller.signal)
        .then((response) => {
          setItems(response.items);
          setActiveIndex(0);
          setError(null);
        })
        .catch((searchError) => {
          if (searchError instanceof DOMException && searchError.name === "AbortError") {
            return;
          }

          setItems([]);
          setActiveIndex(0);
          setError("Search failed");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setShowSpinner(false);
          }
        });
    }, 80);

    onCleanup(() => {
      window.clearTimeout(timeoutId);
      if (spinnerTimeoutId !== undefined) {
        window.clearTimeout(spinnerTimeoutId);
      }
      controller.abort();
    });
  });

  const close = () => {
    props.onClose();
  };

  const openItem = (item: SearchResultItem | undefined) => {
    if (!item) {
      return;
    }

    props.onOpenResult(item.targetPaneKey);
    close();
  };

  const moveActive = (delta: number) => {
    const currentItems = items();

    if (currentItems.length === 0) {
      return;
    }

    setActiveIndex((current) => (current + delta + currentItems.length) % currentItems.length);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Enter") {
      if (event.isComposing || isComposing() || event.keyCode === 229) {
        return;
      }

      event.preventDefault();
      openItem(items()[activeIndex()]);
    }
  };

  const subtitle = (item: SearchResultItem) => (item.subtitle === "" ? "No meaning imported yet" : item.subtitle);

  return (
    <Show when={props.open}>
      <div
        class="command-palette-backdrop"
        onClick={(event) => {
          if (event.currentTarget === event.target) {
            close();
          }
        }}
        onKeyDown={onKeyDown}
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
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              autocomplete="off"
              spellcheck={false}
              placeholder="Search kanji, words, readings, English..."
            />
            <Show when={showSpinner()} fallback={<span class="kbd">⌘K</span>}>
              <span class="command-spinner" aria-label="Searching" />
            </Show>
          </div>

          <div class="command-results" aria-live="polite">
            <Show when={query().trim() === ""}>
              <div class="command-empty">Type a query</div>
            </Show>

            <Show when={query().trim() !== "" && error()}>
              <div class="command-empty">{error()}</div>
            </Show>

            <Show when={query().trim() !== "" && !loading() && !error() && items().length === 0}>
              <div class="command-empty">No results</div>
            </Show>

            <For each={items()}>
              {(item, index) => (
                <button
                  class={`command-result ${index() === activeIndex() ? "active" : ""}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index())}
                  onClick={() => openItem(item)}
                >
                  <span class={`command-glyph ${item.type} jp`}>{item.type === "kanji" ? item.title : item.title.slice(0, 2)}</span>
                  <span class="command-main">
                    <span class="command-title jp">{item.title}</span>
                    <span class="command-subtitle">{subtitle(item)}</span>
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
