import { For, createEffect, onCleanup, onMount } from "solid-js";

import type { HomePageData } from "../../../shared/home-data";
import { createPaneState, describePane } from "../state/pane-state";
import { PaneBody } from "./PaneBody";

export function PaneShell(props: { state: HomePageData }) {
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
