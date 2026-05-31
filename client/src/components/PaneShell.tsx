import { For, createEffect, onCleanup, onMount } from "solid-js";
import { createSignal } from "solid-js";

import type { HomePageData } from "../../../shared/home-data";
import type { SearchTargetPaneKey } from "../../../shared/search";
import { runClassAnimationAfterEvent } from "../dom/class-animation";
import { createPaneState, describePane } from "../state/pane-state";
import { createSrsUiState } from "../state/srs-ui-state";
import { CommandPalette } from "./CommandPalette";
import { PaneBody } from "./PaneBody";

export function PaneShell(props: { state: HomePageData }) {
  let panesElement: HTMLDivElement | undefined;
  let handledScrollRequestId = -1;
  const paneState = createPaneState();
  const [searchOpen, setSearchOpen] = createSignal(false);
  const srsState = createSrsUiState(props.state.review.dueCount);

  onMount(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Escape") {
        paneState.closeRightmost();
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onGlobalKeyDown));
    void srsState.refreshDueCountFromQueue().catch(() => undefined);
  });

  const openSearchResult = (key: SearchTargetPaneKey) => {
    paneState.openFromRoot(key);
  };

  createEffect(() => {
    const panes = paneState.panes();
    const target = paneState.scrollTarget();

    if (target.requestId === handledScrollRequestId) {
      return;
    }
    handledScrollRequestId = target.requestId;

    queueMicrotask(() => {
      const targetIndex = panes.indexOf(target.key);
      const targetElement = targetIndex >= 0 ? panesElement?.children.item(targetIndex) : null;

      if (targetElement && target.flash) {
        runClassAnimationAfterEvent({
          eventTarget: panesElement,
          eventName: "scrollend",
          element: targetElement,
          className: "pane-scroll-flash",
          fallbackMs: 500,
          durationMs: 900,
        });
      }
      targetElement?.scrollIntoView({ inline: "end", behavior: "smooth" });
    });
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
            <span class="badge">{srsState.dueCount()}</span>
          </button>
          <button class="nav-item" type="button" onClick={() => paneState.openFromRoot("srs-status")}>
            Card status
          </button>
          <button class="nav-item nav-item-dim" type="button" onClick={() => setSearchOpen(true)}>
            Search <span class="kbd">⌘K</span>
          </button>
          <div class="nav-section">Library</div>
          <button class="nav-item" type="button" onClick={() => paneState.openFromRoot("list-words")}>
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

                <div class="pane-body">
                  <PaneBody
                    paneKey={paneKey}
                    state={props.state}
                    srsState={srsState}
                    openPane={(key) => paneState.openFromPane(key, index())}
                  />
                </div>
              </section>
            );
          }}
        </For>
      </main>

      <CommandPalette open={searchOpen()} onClose={() => setSearchOpen(false)} onOpenResult={openSearchResult} />
    </div>
  );
}
