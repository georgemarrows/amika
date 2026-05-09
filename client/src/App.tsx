import { Match, Switch, createResource } from "solid-js";

import { fetchHomePageData } from "./api";
import { PaneShell } from "./components/PaneShell";

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
