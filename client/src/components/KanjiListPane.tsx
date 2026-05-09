import type { PaneBodyProps } from "./pane-props";

export function KanjiListPane(props: Pick<PaneBodyProps, "paneIndex" | "openFromPane">) {
  return (
    <>
      <div class="hero">
        <div class="section-title">Kanji · 1</div>
      </div>
      <table class="dict">
        <tbody>
          <tr onClick={() => props.openFromPane("kanji:具", props.paneIndex)}>
            <td class="jp glyph-cell">具</td>
            <td>tool</td>
            <td class="r">imported</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
