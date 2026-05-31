import { render } from "solid-js/web";
import 'solid-devtools';
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

render(() => <App />, root);
