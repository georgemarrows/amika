import { JSX } from "solid-js";

export function PaneTitle(props: { title: string; secondary?: JSX.Element }) {
    return (
        <div class="pane-title">
            <header>
                {props.title}
            </header>
            {props.secondary}
        </div>
    );
}

export function Badge(props: { children: JSX.Element }) {
    return (
        <div class="badge">
            {props.children}
        </div>
    );
}