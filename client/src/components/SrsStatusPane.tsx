import { For, Match, Switch, createMemo, createResource, createSignal } from "solid-js";

import { fetchSrsKanjiMatrix } from "../api";
import {
  createSrsStatusRows,
  initialSrsStatusSort,
  SrsStatusStats,
  toggleSrsStatusSort,
  type SrsStatusCardCellViewModel,
  type SrsStatusSort,
  type SrsStatusSortKey,
} from "../models/srs-status-view-model";
import type { OpenFromPane } from "./pane-props";

export function SrsStatusPane(props: { paneIndex: number; openFromPane: OpenFromPane }) {
  const [matrix] = createResource(fetchSrsKanjiMatrix);
  const [sort, setSort] = createSignal<SrsStatusSort>(initialSrsStatusSort);
  const rows = createMemo(() => {
    const loaded = matrix();

    return loaded ? createSrsStatusRows(loaded, sort()) : [];
  });

  const setSortKey = (key: SrsStatusSortKey) => {
    setSort((current) => toggleSrsStatusSort(current, key));
  };

  return (
    <Switch>
      <Match when={matrix.error}>
        <div class="empty-state">
          <p class="status-label">SRS status unavailable</p>
          <h2>Card status failed to load.</h2>
          <p>Run migrations and refresh. The review queue is separate from this status table.</p>
        </div>
      </Match>
      <Match when={matrix.loading}>
        <div class="empty-state">
          <p class="status-label">Loading</p>
          <h2>Preparing SRS card status...</h2>
        </div>
      </Match>
      <Match when={matrix()}>
        {(loadedMatrix) => (
          <section class="srs-status-shell">
            <div class="review-top">
              <div>
                <div class="section-title">SRS card status</div>
                <p class="subtitle">Kanji with recognition and production cards, sorted by due status.</p>
              </div>
              <div class="review-progress">{loadedMatrix().items.length} kanji</div>
            </div>

            <Switch>
              <Match when={rows().length === 0}>
                <div class="empty-state">
                  <p class="status-label">No SRS cards</p>
                  <h2>No kanji have SRS cards yet.</h2>
                </div>
              </Match>
              <Match when={rows().length > 0}>
                <div class="srs-matrix-wrap">
                  <table class="dict srs-matrix">
                    <thead>
                      <tr>
                        <th>Kanji</th>
                        <th>Meaning</th>
                        <SortableHeader label="Next" sortKey="next" sort={sort()} onSort={setSortKey} />
                        <SortableHeader label="Recognition" sortKey="recognition" sort={sort()} onSort={setSortKey} />
                        <SortableHeader label="Production" sortKey="production" sort={sort()} onSort={setSortKey} />
                        <SortableHeader label="Load" sortKey="load" sort={sort()} onSort={setSortKey} />
                      </tr>
                    </thead>
                    <tbody>
                      <For each={rows()}>
                        {(row) => (
                          <tr onClick={() => props.openFromPane(row.targetPaneKey, props.paneIndex)}>
                            <td class="jp glyph-cell">{row.kanjiLiteral}</td>
                            <td>{row.meaning}</td>
                            <td>
                              <span class={`srs-matrix-chip ${row.nextTone}`}>{row.nextLabel}</span>
                            </td>
                            <td>
                              <CardCell cell={row.recognition} />
                            </td>
                            <td>
                              <CardCell cell={row.production} />
                            </td>
                            <td class="srs-matrix-load">
                              <CardStats stats={row.stats} />
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Match>
            </Switch>
          </section>
        )}
      </Match>
    </Switch>
  );
}

function SortableHeader(props: {
  label: string;
  sortKey: SrsStatusSortKey;
  sort: SrsStatusSort;
  onSort: (key: SrsStatusSortKey) => void;
}) {
  const active = () => props.sort.key === props.sortKey;

  return (
    <th aria-sort={active() ? (props.sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button class={`srs-sort ${active() ? "active" : ""}`} type="button" onClick={() => props.onSort(props.sortKey)}>
        <span>{props.label}</span>
        <span class="srs-sort-indicator">{active() ? props.sort.direction : "sort"}</span>
      </button>
    </th>
  );
}

function CardCell(props: { cell: SrsStatusCardCellViewModel }) {
  return (
    <div class="srs-matrix-cell">
      <span class={`srs-matrix-chip ${props.cell.tone}`}>
        {props.cell.label}
      </span>
      <CardStats stats={props.cell.stats} />
    </div>
  );
}

function CardStats(props: { stats: SrsStatusStats }) {
  return (
    <span class="srs-matrix-meta">
      <span>{props.stats.reps} reps</span>
      <span>{props.stats.lapses} lapses</span>
    </span>
  );
}