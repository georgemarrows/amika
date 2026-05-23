import { For, Match, Show, Switch, createResource } from "solid-js";

import { fetchWordList } from "../api";
import type { PaneBodyProps } from "./pane-props";

export function WordListPane(props: Pick<PaneBodyProps, "openPane">) {
  const [list] = createResource(fetchWordList);

  return (
    <Switch>
      <Match when={list.error}>
        <div class="empty-state">
          <p class="status-label">Words unavailable</p>
          <h2>All words</h2>
          <p>Run the migrate/import flow and refresh.</p>
        </div>
      </Match>
      <Match when={list.loading}>
        <div class="empty-state">
          <p class="status-label">Loading</p>
          <h2>All words</h2>
        </div>
      </Match>
      <Match when={list()}>
        {(loadedList) => (
          <>
            <div class="hero">
              <div class="section-title">Words · {loadedList().items.length}</div>
            </div>
            <Show when={loadedList().items.length > 0} fallback={<div class="muted">No words imported yet.</div>}>
              <table class="dict">
                <tbody>
                  <For each={loadedList().items}>
                    {(word) => (
                      <tr onClick={() => props.openPane(`word:${word.id}`)}>
                        <td class="jp">{word.expression}</td>
                        <td class="jp">{word.reading ?? ""}</td>
                        <td>{word.meaning ?? "Unknown"}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </>
        )}
      </Match>
    </Switch>
  );
}
