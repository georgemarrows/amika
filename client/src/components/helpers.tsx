import { splitProps, type ParentProps, type JSX } from "solid-js";

type ColumnsProps = ParentProps<
  Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
    gridTemplateColumns?: JSX.CSSProperties["grid-template-columns"];
    alignItems?: JSX.CSSProperties["align-items"];
    gap?: JSX.CSSProperties["gap"];
  }
>;

export function Columns(props: ColumnsProps) {
  const [local, rest] = splitProps(props, [
    "children",
    "gridTemplateColumns",
    "alignItems",
    "gap",
  ]);

  return (
    <div
      {...rest}
      style={{
        display: "grid",
        "grid-template-columns": local.gridTemplateColumns,
        "align-items": local.alignItems,
        gap: local.gap,
      }}
    >
      {local.children}
    </div>
  );
}