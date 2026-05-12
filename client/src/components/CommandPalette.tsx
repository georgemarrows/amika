import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";

import type { SearchResultItem, SearchTargetPaneKey } from "../../../shared/search";
import { fetchSearchResults } from "../api";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onOpenResult: (key: SearchTargetPaneKey) => void;
};

type SearchStatus = "idle" | "debouncing" | "loading-quiet" | "loading-visible" | "ready" | "empty" | "error";

export function CommandPalette(props: CommandPaletteProps) {
  let inputElement: HTMLInputElement | undefined;
  const [query, setQuery] = createSignal("");
  const [items, setItems] = createSignal<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [status, setStatus] = createSignal<SearchStatus>("idle");
  const [isComposing, setIsComposing] = createSignal(false);

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
          setItems(response.items);
          setActiveIndex(0);
          setStatus(response.items.length === 0 ? "empty" : "ready");
        })
        .catch((searchError) => {
          if (searchError instanceof DOMException && searchError.name === "AbortError") {
            return;
          }

          setItems([]);
          setActiveIndex(0);
          setStatus("error");
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
  const showSpinner = () => status() === "loading-visible";

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
            <Show when={status() === "idle"}>
              <div class="command-empty">Type a query</div>
            </Show>

            <Show when={status() === "error"}>
              <div class="command-empty">Search failed</div>
            </Show>

            <Show when={status() === "empty"}>
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
