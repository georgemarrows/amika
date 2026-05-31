import { For, Match, Show, Switch, createResource } from "solid-js";

import { fetchKanjiList } from "../api";
import type { PaneBodyProps } from "./pane-props";
import { Badge, PaneTitle } from "./standard/components";

export function KanjiListPane(props: Pick<PaneBodyProps, "openPane">) {
  const [list] = createResource(fetchKanjiList);

  return (
    <Switch>
      <Match when={list.error}>
        <div class="empty-state">
          <p class="status-label">Kanji unavailable</p>
          <h2>All kanji</h2>
          <p>Run the migrate/import flow and refresh.</p>
        </div>
      </Match>
      <Match when={list.loading}>
        <div class="empty-state">
          <p class="status-label">Loading</p>
          <h2>All kanji</h2>
        </div>
      </Match>
      <Match when={list()}>
        {(loadedList) => (
          <>
            <PaneTitle title={`Kanji`} secondary={<Badge>{loadedList().items.length}</Badge>} />
            
            <Show when={loadedList().items.length > 0} fallback={<div class="muted">No kanji imported yet.</div>}>
              <table class="dict">
                <tbody>
                  <For each={loadedList().items}>
                    {(kanji) => (
                      <tr onClick={() => props.openPane(`kanji:${kanji.literal}`)}>
                        <td class="jp glyph-cell">{kanji.literal}</td>
                        <td>{kanji.meaning}</td>
                        <td class="r">{kanji.strokeCount === null ? "" : `${kanji.strokeCount} strokes`}</td>
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
