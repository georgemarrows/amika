import { For } from "solid-js";

import type { HomePageData } from "../../shared/home-data";
import { createHomePageViewModel } from "./models/home-view-model";

type HomePageProps = {
  state: HomePageData;
};

export function HomePage(props: HomePageProps) {
  const model = createHomePageViewModel(props.state);

  return (
    <div class="app-shell">
      <aside class="sidebar">
        <div class="logo">
          Amika <span class="logo-jp">網化</span>
        </div>

        <nav class="nav">
          <a class="nav-item nav-item-active" href="/">Home</a>
          <div class="nav-item">
            <span>Review</span>
            <span class="badge">{props.state.review.dueCount}</span>
          </div>
          <div class="nav-item nav-item-dim">Search</div>
          <div class="nav-section">Library</div>
          <div class="nav-item nav-item-dim">Words</div>
          <div class="nav-item nav-item-dim">Kanji</div>
          <div class="nav-item nav-item-dim">Grammar</div>
          <div class="nav-item nav-item-dim">Texts</div>
        </nav>
      </aside>

      <main class="home-pane">
        <header class="pane-header">
          <div>
            <p class="eyebrow">Home</p>
            <h1>{props.state.title}</h1>
          </div>
          <p class="subtle">{props.state.subtitle}</p>
        </header>

        <section class="card card-review">
          <p class="card-label">Today&apos;s review</p>
          <h2>{model.reviewHeadline}</h2>
          <p>{props.state.review.summary}</p>
        </section>

        <section class="card-grid">
          <article class="card">
            <p class="card-label">Latest source</p>
            <h2>{props.state.latestSource.title}</h2>
            <p>{model.latestSourceMeta}</p>
          </article>

          <article class="card">
            <p class="card-label">Recent additions</p>
            <ul class="plain-list">
              <For each={props.state.recentAdditions}>
                {(item) => (
                  <li>
                    <span class="jp">{item.label}</span>
                    <span class="list-meta">{item.meta}</span>
                  </li>
                )}
              </For>
            </ul>
          </article>
        </section>

        <section class="card">
          <p class="card-label">Explore</p>
          <ul class="plain-list plain-list-spacious">
            <For each={props.state.explorationCards}>
              {(item) => (
                <li>
                  <strong>{item.title}</strong>
                  <span class="list-meta">{item.description}</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </main>
    </div>
  );
}
